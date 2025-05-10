/*
 * API Routing and transport system structure files handle functions
 */

const { getMidPointByTwoStopCodes } = require("./mapMidPoint");
const { computeRoute } = require("./routing");

let routingState = {'state': 'no_data'};
let routingProgress = 0;
let routingIsRunning = false;

// Used in import user case, create more stops in one query
async function createStops(db, params) {
    if (params.stops === undefined) {
        return false;
    }

    let stopsQuery = "";
    let signsQuery = "";

    let inputData = JSON.parse(params.stops);

    for (let i = 0; i < inputData.length; i++) {
        stopsQuery += "(" + inputData[i].code + ",'" + inputData[i].name + "'";

        let inspSign = Object.keys(inputData[i].signs);
        for (let j = 0; j < inspSign.length; j++) {
            let latLng = [parseFloat(inspSign[j].split('_')[0]), parseFloat(inspSign[j].split('_')[1])];
            signsQuery += "('{" + '"type": "Point", "coordinates": ' + JSON.stringify(latLng) + "}'";
            signsQuery += ", " + inputData[i].code + ", ARRAY " + JSON.stringify(inputData[i].signs[inspSign[j]]).replaceAll('"', "'");

            if (inspSign.length > 0 && j < (inspSign.length - 1)) {
                signsQuery += "),";
            }
        }

        if (inputData.length > 0 && i < (inputData.length - 1)) {
            stopsQuery += "),";
            signsQuery += "),";
        }
    }

    stopsQuery += ")";
    signsQuery += ")";

    try {
        await db.query("INSERT INTO " + process.env.DB_STOPS_TABLE +
        ' (code, name) VALUES ' + stopsQuery);
        await db.query("INSERT INTO " + process.env.DB_SIGNS_TABLE +
        ' (geom, code, subCodes) VALUES ' + signsQuery);
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

// Clear selected DB table
async function clearData(db, params) {
    if (params.type === undefined) {
        return false;
    }
    try {
        if (params.type === 'stops') {
            await db.query("TRUNCATE TABLE " + process.env.DB_STOPS_TABLE + " RESTART IDENTITY");
            await db.query("TRUNCATE TABLE " + process.env.DB_SIGNS_TABLE + " RESTART IDENTITY");
        }

        if (params.type === 'lines') {
            await db.query("TRUNCATE TABLE " + process.env.DB_LINES_TABLE + " RESTART IDENTITY");
        }

        if (params.type === 'lineCodes') {
            await db.query("TRUNCATE TABLE " + process.env.DB_LINE_CODES_TABLE + " RESTART IDENTITY");
        }

        if (params.type === 'midpoints') {
            await db.query("TRUNCATE TABLE " + process.env.DB_MIDPOINTS_TABLE + " RESTART IDENTITY");
        }

        await db.query("TRUNCATE TABLE " + process.env.DB_ROUTES_TABLE + " RESTART IDENTITY");
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

// Return stops around some coords
async function getStopsInRad(db, params) {
    if (params.geom === undefined) {
        return false;
    }

    let point = JSON.parse(params.geom);

    if (point[0] === undefined || point[1] === undefined ) {
        return false;
    }

    try {
        let result = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
        " WHERE ST_DistanceSphere(geom, ST_MakePoint(" + point[0] + "," + point[1] + ")) <= 2000 " + 
        "ORDER BY ST_DistanceSphere(geom, ST_MakePoint(" + point[0] + "," + point[1] + "))" +
        "LIMIT " + process.env.MAX_LOAD_POINTS * 3);

        for (let i = 0; i < result.rows.length; i++) {
            result.rows[i]['geom'] = JSON.parse(result.rows[i]['st_asgeojson']).coordinates;
            delete result.rows[i]['st_asgeojson'];

            let name = await db.query("SELECT name FROM " + process.env.DB_STOPS_TABLE + " WHERE code=" + result.rows[i]['code']);
            if (name.rows[0] !== undefined) {
                result.rows[i]['name'] = name.rows[0].name;
            }
            delete result.rows[i]['id'];
        }
        return result.rows;
    } catch(err) {
        console.log(err);
        return false;
    }
}

// Get one route structure
async function getRoute(db, params) {
    if (params.layer === undefined) {
        return false;
    }

    if (params.stops === undefined) {
        return false;
    }

    let stops = JSON.parse(params.stops);
    let result = await getStopsGeom(db, stops);

    if (result.points.length < 1) {
        return false;
    }

    return {'stops': result.stops, 'route': await computeRoute(db, result.points, params.layer), 'stopNames': result.stopNames};
}

// Get route stops geometry and prepare them for routing
async function getStopsGeom(db, stops) {
    let points = [];
    let stopsPoss = [];
    let stopNames = [];
    for (let i = 0; i < stops.length; i++) {
        try {
            let stop = await db.query("SELECT geom, ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
                " WHERE code=" + parseInt(stops[i].split('_')[0]) + " AND '" + stops[i].split('_')[1] + "'=ANY(subcodes)");
            if (stop.rows !== undefined && stop.rows[0] !== undefined) {
                let acStopPoss = JSON.parse(stop.rows[0].st_asgeojson).coordinates;
                if (acStopPoss[0] !== 0 && acStopPoss[1] !== 0) {
                    stopsPoss.push(acStopPoss);

                    if (stops[i].split('_')[3] !== 'd') {
                        if (stops[i].split('_').length > 2 && stop.rows[0].geom[0] !== 0 && stop.rows[0].geom[1] !== 0) {
                            points.push({'geom': stop.rows[0].geom, 'specCode': stops[i].split('_')[2]});
                        } else {
                            points.push({'geom': stop.rows[0].geom, 'specCode': ''});
                        }
                    }

                    stopNames.push(await getStopName(db, stops, i) + ' ' + stops[i].split('_')[1]);
    
                    if (i < (stops.length - 1)) {
                        let midpoint = await getMidPointByTwoStopCodes(db, stops[i].split('_')[0] + '_' + stops[i].split('_')[1],
                            stops[i + 1].split('_')[0] + '_' + stops[i + 1].split('_')[1]);
    
                        if (midpoint && stops[i].split('_')[3] !== 'd' && stops[i + 1].split('_')[3] !== 'd') {
                            stopsPoss = stopsPoss.concat(midpoint.stopPoss);
                            points = points.concat(midpoint.points);
                            for (let i = 0; i < midpoint.points.length; i++) {
                                 stopNames.push('Medzibod');
                            }
                        }
                    }
                }
            }
        } catch(err) {
            console.log(err);
        }
    }

    return {stops: stopsPoss, points: points, stopNames: stopNames};
}

// Used in import use case, lines structure
async function saveLines(db, params) {
    if (params.lines === undefined) {
        return false;
    }

    let data = JSON.parse(params.lines);
    let query = "";

    for (let i = 0; i < data.length; i++) {
        let routesA = "";
        let routesB = "";

        for (const [idx, route] of data[i].routesA.entries()) {
            if (idx > 0) {
                routesA += `, "${route.toString()}"`;
            } else {
                routesA += `"${route.toString()}"`;
            }
        }

        for (const [idx, route] of data[i].routesB.entries()) {
            if (idx > 0) {
                routesB += `, "${route.toString()}"`;
            } else {
                routesB += `"${route.toString()}"`;
            }
        }

        query += "(" + data[i].lc + ", '" + data[i].type +
            "', '{" + routesA + "}', '{" + routesB + "}')";

        if (data.length > 0 && i < (data.length - 1)) {
            query += ",";
        }

        await db.query("DELETE FROM " + process.env.DB_LINES_TABLE + " WHERE code=" + data[i].lc);
    }

    try {
        await db.query("INSERT INTO " + process.env.DB_LINES_TABLE +
        ' (code, layer, routesA, routesB) VALUES ' + query);
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

// Return lines with its codes and end stops
async function getLines(db) {
    try {
        let result = await db.query("SELECT * FROM " + process.env.DB_LINES_TABLE + " ORDER BY code");

        for (let i = 0; i < result.rows.length; i++) {
            let route_start = undefined, route_end = undefined;
            route_start = await getStopName(db, result.rows[i].routesa[0].split(','), 0);
            route_end = await getStopName(db, result.rows[i].routesa[0].split(','), result.rows[i].routesa[0].split(',').length - 1);

            delete result.rows[i]['routesa'];
            if (route_start !== undefined && route_end !== undefined) {
                result.rows[i]['routeA'] = {'s': route_start, 'e': route_end};
            }

            route_start = await getStopName(db, result.rows[i].routesb[0].split(','), 0);
            route_end = await getStopName(db, result.rows[i].routesb[0].split(','), result.rows[i].routesb[0].split(',').length - 1);

            delete result.rows[i]['routesb'];
            if (route_start !== undefined && route_end !== undefined) {
                result.rows[i]['routeB'] = {'s': route_start, 'e': route_end};
            }

            delete result.rows[i]['id'];

            let lineName;
            try {
                lineName = await db.query("SELECT code, name FROM " + process.env.DB_LINE_CODES_TABLE + " WHERE code=" + result.rows[i]['code']);
            } catch(err) {
                console.log(err);
                continue;
            }
            
            if (lineName.rows[0] !== undefined) {
                result.rows[i]['name'] = lineName.rows[0].name;
            } else {
                result.rows[i]['name'] = result.rows[i]['code'].toString();
            }

            result.rows[i]['label'] = result.rows[i]['code'] + '/' + result.rows[i]['name'];
            result.rows[i]['value'] = result.rows[i]['code'];
        }

        return result.rows;
    } catch(err) {
        console.log(err);
        return false;
    }

}

async function getStopName(db, codes, idx) {
    let result = undefined;
    if (codes !== undefined && codes[idx] !== undefined && codes[idx].split('_').length > 1) {
        result = await db.query("SELECT * FROM " + process.env.DB_STOPS_TABLE +
            " WHERE code=" + parseInt(codes[idx].split('_')[0]));
        if (result.rows !== undefined) {
            return result.rows[0].name;
        }
    } else {
        return undefined;
    }
}

// Compute one route (line in one direction)
async function getLineRoute(db, params) {
    if (params.code === undefined) {
        return false;
    }

    if (params.dir === undefined) {
        return false;
    }

    let line = await db.query("SELECT * FROM " + process.env.DB_LINES_TABLE + " WHERE code=" + params.code);

    if (line.rows === undefined || line.rows[0] === undefined) {
        return false;
    }

    let result;
    let lineCodes = [];
    if (params.dir === 'a') {
        for (const alternative of line.rows[0].routesa) {
            lineCodes.push(alternative.split(','));
        }
    } else if (params.dir === 'b') {
        for (const alternative of line.rows[0].routesb) {
            lineCodes.push(alternative.split(','));
        }
    }

    let route = [];
    for (const [idx, routePart] of lineCodes.entries()) {
        let dataForRouting;
        if (idx === 0) {
            result = await getStopsGeom(db, routePart);
            dataForRouting = result;
        } else {
            dataForRouting = await getStopsGeom(db, routePart);
        }

        if (dataForRouting.points.length < 1) {
            continue;
        }

        try {
            route = route.concat(await computeRoute(db, dataForRouting.points, line.rows[0].layer));
        } catch(err) {
            console.log(err);
        }
    }

    return {'stops': result.stops, 'route': route, 'stopNames': result.stopNames};
}

// Get info about whole line and all its routes
async function getLineRouteInfo(db, params) {
    if (params.code === undefined) {
        return false;
    }

    if (params.dir === undefined) {
        return false;
    }

    let line = await db.query("SELECT * FROM " + process.env.DB_LINES_TABLE + " WHERE code=" + params.code);

    if (line.rows === undefined || line.rows[0] === undefined) {
        return false;
    }

    let lineCodes = []
    if (params.dir === 'a') {
        for (const route of line.rows[0].routesa) {
            lineCodes.push(route.split(','));
        }
    } else if (params.dir === 'b') {
        for (const route of line.rows[0].routesb) {
            lineCodes.push(route.split(','));
        }
    }

    let result = [];
    let stopNames;

    stopNames = (await getStopsGeom(db, lineCodes[0])).stopNames;

    if (stopNames.length < 1) {
        return false;
    }

    let idx = 0;
    result[0] = [];
    for (let name of stopNames) {
        if (name === 'Medzibod') {
            continue;
        }
        result[0].push({code: lineCodes[0][idx], label: name});
        idx++;
    }

    for (let i = 1; i < lineCodes.length; i++) {
        result.push(lineCodes[i]);
    }

    return result;
}

// Update route's structure
async function updateLineRouteInfo(db, params) {
    if (params.code === undefined) {
        return false;
    }

    if (params.dir === undefined) {
        return false;
    }

    if (params.routes === undefined) {
        return false;
    }

    let line = await db.query("SELECT * FROM " + process.env.DB_LINES_TABLE + " WHERE code=" + params.code);

    if (line.rows === undefined || line.rows[0] === undefined) {
        return false;
    }

    params.routes = JSON.parse(params.routes);

    try {
        let routes = "";

        for (const [idx, route] of params.routes.entries()) {
            if (idx > 0) {
                routes += `, "${route.toString()}"`;
            } else {
                routes += `"${route.toString()}"`;
            }
        }

        if (params.dir === 'a') {
            await db.query("UPDATE " + process.env.DB_LINES_TABLE + " SET routesa = '{" + routes +
            "}' WHERE code=" + params.code);
        } else {
            await db.query("UPDATE " + process.env.DB_LINES_TABLE + " SET routesb = '{" + routes +
            "}' WHERE code=" + params.code);
        }
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

// Get simplified info about whole line and all its routes
async function getLineRoutesInfo(db, params) {
    if (params.code === undefined) {
        return false;
    }

    let line = await db.query("SELECT * FROM " + process.env.DB_LINES_TABLE + " WHERE code=" + params.code);

    if (line.rows === undefined || line.rows[0] === undefined) {
        return false;
    }

    let lineName;
    try {
        lineName = await db.query("SELECT code, name FROM " + process.env.DB_LINE_CODES_TABLE + " WHERE code=" + params.code);
    } catch(err) {
        console.log(err);
    }

    if (lineName.rows[0] !== undefined) {
        lineName = lineName.rows[0].name;
    } else {
        lineName = params.code;
    }

    let routesA = [];
    for (const route of line.rows[0].routesa) {
        routesA.push(route.split(","));
    }

    let routesB = [];
    for (const route of line.rows[0].routesb) {
        routesB.push(route.split(","));
    }

    return {a: routesA, b: routesB, lc: lineName};
}

// Main function, compute geographically precise routes for all lines in DB
async function routing(db, params) {
    if (routingState.state === 'routing' && params.cancel === 'true') {
        routingIsRunning = false;
        return routingState;
    } 

    if (routingState.state === 'routing') {
        routingState.progress = routingProgress;
        return routingState;
    }

    // If routing is running, return progress state
    if (params.reroute === undefined || params.reroute !== 'true') {
        try {
            let result = await db.query("SELECT COUNT(id) FROM " + process.env.DB_ROUTES_TABLE);
            if (parseInt(result.rows[0].count) === 0) {
                routingState.state = "no_data";
            } else {
                routingState.state = 'data_available';
                try {
                    let date = (await db.query("SELECT * FROM " + process.env.DB_ROUTES_TABLE + " WHERE (routecode='time')")).rows[0];
                    routingState.date = date.points[0];                 
                } catch(err) {
                    console.log(err);
                    return false;
                }
            };
    
            return routingState;
        } catch(err) {
            console.log(err);
            return false;
        }
    }

    // Routing itself
    new Promise(async function() {
        try {
            await db.query("TRUNCATE TABLE " + process.env.DB_ROUTES_TABLE + " RESTART IDENTITY");

            let result = await db.query("SELECT * FROM " + process.env.DB_LINES_TABLE + " ORDER BY code");
            routingState.state = 'routing';
            routingState.progress = 0;
            routingIsRunning = true;
    
            const start = Date.now();
            for (let i = 0; i < result.rows.length; i++) {
                if (result.rows[i].routesa !== undefined && result.rows[i].routesa[0].length > 1) {
                    let route = (await getLineRoute(db, {code: result.rows[i].code, dir: 'a'})).route;
                    try {
                        await db.query("INSERT INTO " + process.env.DB_ROUTES_TABLE + " (routeCode, points) VALUES ('" +
                        result.rows[i].code + "_a', '{" + JSON.stringify(route) + "}')");
                    } catch(err) {
                        console.log(err);
                    }
                }

                if (!routingIsRunning) {
                    await db.query("TRUNCATE TABLE " + process.env.DB_ROUTES_TABLE + " RESTART IDENTITY");
                    routingState = {state: 'no_data', progress: -1};
                    return;
                }

                if (result.rows[i].routesb !== undefined && result.rows[i].routesb[0].length > 1) {
                    let route = (await getLineRoute(db, {code: result.rows[i].code, dir: 'b'})).route;
                    try {
                        await db.query("INSERT INTO " + process.env.DB_ROUTES_TABLE + " (routeCode, points) VALUES ('" +
                        result.rows[i].code + "_b', '{" + JSON.stringify(route) + "}')");
                    } catch(err) {
                        console.log(err);
                    }
                }

                if (!routingIsRunning) {
                    await db.query("TRUNCATE TABLE " + process.env.DB_ROUTES_TABLE + " RESTART IDENTITY");
                    routingState = {state: 'no_data', progress: -1};
                    return;
                }

                routingProgress = Math.round(i / result.rows.length * 100);
            }
    
            routingState.state = 'data_available';
            routingState.progress = undefined;

            try {
                await db.query("INSERT INTO " + process.env.DB_ROUTES_TABLE + " (routeCode, points) VALUES ('time', '{" + new Date() + "}')");
            } catch(err) {
                console.log(err);
            }

            const end = Date.now();
            console.log(`Routing time: ${(end - start) / 1000} s`);
        } catch(err) {
            console.log(err);
            return false;
        }
    });

    routingState.state = 'routing';
    routingState.progress = 0;

    return routingState;
}

// Used in export use case, return computed route from DB
async function getRoutedLine(db, params) {
    if (params.code === undefined) {
        return false;
    }

    if (params.dir === undefined) {
        return false;
    }

    let route = await db.query("SELECT * FROM " + process.env.DB_ROUTES_TABLE + " WHERE routecode='" + params.code + '_' + params.dir + "'");

    if (route.rows === undefined || route.rows[0] === undefined || route.rows[0].points === undefined) {
        return false;
    }

    return JSON.parse(route.rows[0].points);
}

// Used in import use case, save line codes
async function saveLineCodes(db, params) {
    if (params.lineCodes === undefined) {
        return false;
    }

    let data = JSON.parse(params.lineCodes);
    let query = "";

    for (let i = 0; i < data.length; i++) {
        query += "(" + data[i].lc + ", '" + data[i].lName + "')";

        if (data.length > 0 && i < (data.length - 1)) {
            query += ",";
        }
    }

    try {
        await db.query("INSERT INTO " + process.env.DB_LINE_CODES_TABLE +
        ' (code, name) VALUES ' + query);
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

module.exports = { createStops, clearData, getStopsInRad, getRoute, saveLines, getLines, getLineRoute,
    saveLineCodes, routing, getRoutedLine, getLineRouteInfo, updateLineRouteInfo, getLineRoutesInfo };
