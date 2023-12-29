const { getMidPointByOneStopCode } = require("./mapMidPoint");
const { computeRoute } = require("./routing");

async function createStops(db, params) {
    if (params.stops === undefined) {
        return false;
    }

    let query = "";
    let data = JSON.parse(params.stops);
    let signsQuery = "";

    for (let i = 0; i < data.length; i++) {
        query += "(" + data[i].id + ", '" + data[i].n + "')";

        if (data.length > 0 && i < (data.length - 1)) {
            query += ",";
        }

        for (let j = 0; j < data[i].p.length; j++) {
            signsQuery += "(" + data[i].id + ", '" + data[i].p[j].n + "', '{" +
                '"type": "Point", "coordinates": ' + JSON.stringify(data[i].p[j].p) + "}')";
            
            if (data[i].p.length > 0 && j < (data[i].p.length - 1)) {
                signsQuery += ",";
            }
        }

        if (data[i].p.length > 0 && i < (data.length - 1)) {
            signsQuery += ",";
        }
    }

    try {
        await db.query("INSERT INTO " + process.env.DB_STOPS_TABLE +
        ' (code, name) VALUES ' + query);
        await db.query("INSERT INTO " + process.env.DB_SIGNS_TABLE +
        ' (code, subCode, geom) VALUES ' + signsQuery);
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function clearData(db, params) {
    if (params.type === undefined) {
        return false;
    }
    try {
        if (params.type === 'stops') {
            await db.query("TRUNCATE TABLE " + process.env.DB_STOPS_TABLE + " RESTART IDENTITY");
            await db.query("DROP TABLE signs");
            await db.query("CREATE TABLE IF NOT EXISTS signs (id SERIAL PRIMARY KEY, code INT, subCode INT, geom GEOMETRY);");
        }

        if (params.type === 'lines') {
            await db.query("TRUNCATE TABLE " + process.env.DB_LINES_TABLE + " RESTART IDENTITY");
        }

        if (params.type === 'lineCodes') {
            await db.query("TRUNCATE TABLE " + process.env.DB_LINE_CODES_TABLE + " RESTART IDENTITY");
        }
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function getStopsInRad(db, params) {
    if (params.geom === undefined) {
        return false;
    }

    let point = JSON.parse(params.geom);

    if (point[0] === undefined || point[1] === undefined ) {
        return false;
    }

    if (params.midPoints === undefined) {
        params.midPoints = false;
    }

    try {
        let result = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
        " WHERE ST_DistanceSphere(geom, ST_MakePoint(" + point[0] + "," + point[1] + ")) <= 2000 " + 
        "ORDER BY ST_DistanceSphere(geom, ST_MakePoint(" + point[0] + "," + point[1] + "))" +
        "LIMIT " + process.env.MAX_LOAD_POINTS * 3);

        let midpoints = [];

        for (let i = 0; i < result.rows.length; i++) {
            result.rows[i]['geom'] = JSON.parse(result.rows[i]['st_asgeojson']).coordinates;
            delete result.rows[i]['st_asgeojson'];

            let name = await db.query("SELECT name FROM " + process.env.DB_STOPS_TABLE + " WHERE code=" + result.rows[i]['code']);
            if (name.rows[0] !== undefined) {
                result.rows[i]['name'] = name.rows[0].name;
            }
            delete result.rows[i]['id'];

            if (params.midPoints === 'true') {
                let midpoint = await getMidPointByOneStopCode(db, result.rows[i]['code'] + '_' + result.rows[i]['subcode']);

                if (midpoint) {
                    midpoints = midpoints.concat(midpoint);
                }
            }
        }
        return {'stops': result.rows, 'midpoints': midpoints};
    } catch(err) {
        console.log(err);
        return false;
    }
}

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

    return {'stops': result.stops, 'route': await computeRoute(db, result.points, params.layer)};
}

async function getStopsGeom(db, stops) {
    let points = [];
    let stopsPoss = [];
    for (let i = 0; i < stops.length; i++) {
        try {
            let stop = await db.query("SELECT geom, ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
                " WHERE code=" + parseInt(stops[i].split('_')[0]) + " AND subcode='" + parseInt(stops[i].split('_')[1]) + "'");
            if (stop.rows !== undefined && stop.rows[0] !== undefined) {
                stopsPoss.push(JSON.parse(stop.rows[0].st_asgeojson).coordinates);
                if (stops[i].split('_').length > 2) {
                    points.push({'geom': stop.rows[0].geom, 'specCode': stops[i].split('_')[2]});
                } else {
                    points.push({'geom': stop.rows[0].geom, 'specCode': ''});
                }
            }
        } catch(err) {
            console.log(err);
        }
    }

    return {'stops': stopsPoss, 'points': points};
}

async function saveLines(db, params) {
    if (params.lines === undefined) {
        return false;
    }

    let data = JSON.parse(params.lines);
    let query = "";

    for (let i = 0; i < data.length; i++) {
        query += "(" + data[i].lc + ", '" + data[i].type +
            "', '{" + data[i].routeA + "}', '{" + data[i].routeB + "}')";

        if (data.length > 0 && i < (data.length - 1)) {
            query += ",";
        }
    }

    try {
        await db.query("INSERT INTO " + process.env.DB_LINES_TABLE +
        ' (code, layer, routeA, routeB) VALUES ' + query);
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function getLines(db) {
    try {
        let result = await db.query("SELECT * FROM " + process.env.DB_LINES_TABLE + " ORDER BY code");

        for (let i = 0; i < result.rows.length; i++) {
            let route_start = undefined, route_end = undefined;
            route_start = await getRouteStartName(db, result.rows[i].routea);
            route_end = await getRouteEndName(db, result.rows[i].routea);

            delete result.rows[i]['routea'];
            if (route_start !== undefined && route_end !== undefined) {
                result.rows[i]['routeA'] = {'s': route_start, 'e': route_end};
            }

            route_start = await getRouteStartName(db, result.rows[i].routeb);
            route_end = await getRouteEndName(db, result.rows[i].routeb);

            delete result.rows[i]['routeb'];
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
        }

        return result.rows;
    } catch(err) {
        console.log(err);
        return false;
    }

}

async function getRouteStartName(db, codes) {
    let result = undefined;
    if (codes !== undefined && codes.length > 0 && codes[0].split('_').length  > 1) {
        result = await db.query("SELECT * FROM " + process.env.DB_STOPS_TABLE +
            " WHERE code=" + parseInt(codes[0].split('_')[0]));
        if (result.rows !== undefined) {
            return result.rows[0].name;
        }
    } else {
        return undefined;
    }
}

async function getRouteEndName(db, codes) {
    let result = undefined;
    if (codes !== undefined && codes.length > 0 && codes[codes.length - 1].split('_').length > 1) {
        result = await db.query("SELECT * FROM " + process.env.DB_STOPS_TABLE +
            " WHERE code=" + parseInt(codes[codes.length - 1].split('_')[0]));
        if (result.rows !== undefined) {
            return result.rows[0].name;
        }
    } else {
        return undefined;
    }
}

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

    if (params.dir === 'a') {
        result = await getStopsGeom(db, line.rows[0].routea);
    } else if (params.dir === 'b') {
        result = await getStopsGeom(db, line.rows[0].routeb);
    }

    if (result.points.length < 1) {
        return false;
    }

    return {'stops': result.stops, 'route': await computeRoute(db, result.points, line.rows[0].layer)};
}

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

module.exports = { createStops, clearData, getStopsInRad, getRoute, saveLines, getLines, getLineRoute, saveLineCodes };