let tables = {
    'rail': process.env.DB_RAIL_TABLE,
    'road': process.env.DB_ROAD_TABLE,
    'tram': process.env.DB_TRAM_TABLE
}

async function computeRoute(db, stops, layer) {
    let result = [];
    let possibilities = [];

    stops = await getStopsData(db, stops);

    for (let i = 0; i < stops.length - 1; i++) {
        if (possibilities.length === 0) {
            possibilities = await findInNet(db, stops[i], layer);
        }

        if (possibilities.length === 0) {
            continue;
        }

        let subNet = await getSubNet(db, layer, stops[i], stops[i + 1]);

        let keys = Object.keys(subNet);
        for (let i = 0; i < keys.length; i++) {
            result.push(keys[i]);
        }
    }

    return await decode(db, result, layer);
}

async function getStopsData(db, stops) {
    for (let i = 0; i < stops.length; i++) {
        let stop;
        try {
            stop = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
            " WHERE geom='" + stops[i] + "'");
        } catch(err) {
            console.log(err);
            return false;
        }

        if (stop.rows === undefined) {
            stops[i] = undefined;
            continue;
        }

        stop.rows[0].pos = JSON.parse(stop.rows[0].st_asgeojson).coordinates;
        delete stop.rows[0].st_asgeojson;
        stops[i] = stop.rows[0];
    }

    return stops;
}

async function findInNet(db, stop, layer) {
    let response;
    try {
        response = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + tables[layer] +
        " WHERE ST_DistanceSphere(geom,'" + stop.geom + "') <= 200 " + 
        "ORDER BY ST_DistanceSphere(geom,'" + stop.geom + "') LIMIT 6");
    } catch(err) {
        console.log(err);
        return false;
    }

    if (response.rows === undefined || response.rows.length < 1) {
        return [];
    }

    let gids = {};
    let lines = {};
    for (let i = 0; i < response.rows.length; i++) {
        gids[response.rows[i].gid] = response.rows[i];
        for (let j = 0; j < response.rows[i].conns.length; j++) {
            let key = "";
            if (response.rows[i].gid > response.rows[i].conns[j]) {
                key = response.rows[i].gid + '_' + response.rows[i].conns[j];
            } else {
                key = response.rows[i].conns[j] + '_' + response.rows[i].gid;
            }

            if (lines[key] === undefined) {
                lines[key] = {'a': response.rows[i].gid, 'b': response.rows[i].conns[j], 'score': 0, 'dir': 0};
            } else {
                lines[key].dir = 1;
            }
        }
    }

    let result = [];
    let keys = Object.keys(lines);

    for (let i = 0; i < keys.length; i++) {
        let pointA = gids[lines[keys[i]].a];
        let pointB = gids[lines[keys[i]].b];

        if (pointA === undefined || pointB === undefined) {
            continue;
        }

        pointA = JSON.parse(pointA.st_asgeojson).coordinates;
        pointB = JSON.parse(pointB.st_asgeojson).coordinates;

        lines[keys[i]].score = triangulation(pointA, pointB, stop.pos);
        if (lines[keys[i]].score < Infinity) {
            result.push(lines[keys[i]]);
        }
    }

    return result;
}

async function getSubNet(db, layer, stopA, stopB) {
    let response;
    let result = {};
    let centerPoint = [Math.abs(stopA.pos[0] + stopB.pos[0]) / 2, Math.abs(stopA.pos[1] + stopB.pos[1]) / 2];
    centerPoint = "'{" + '"type": "Point", "coordinates": ' + JSON.stringify(centerPoint) + "}'";

    try {
        response = await db.query("SELECT gid, conns, ST_AsGeoJSON(geom) FROM " + tables[layer] +
        " WHERE ST_DistanceSphere(geom, " + centerPoint + ") <= ST_DistanceSpheroid('" + stopA.geom + "'," + centerPoint + ") + 30");
    } catch(err) {
        console.log(err);
        return false;
    }

    if (response.rows === undefined || response.rows.length < 1) {
        return {};
    }

    for (let i = 0; i < response.rows.length; i++) {
        result[response.rows[i].gid] = {'pos': JSON.parse(response.rows[i].st_asgeojson).coordinates, 'conns': response.rows[i].conns}
    }

    return result;
}

function triangulation(edgeA, edgeB, point) {
    let angleCAB = getAngle(point, edgeA, edgeB);
    let angleCBA = getAngle(point, edgeB, edgeA);

    if (angleCAB > 1.61 || angleCBA > 1.61) {
        return Infinity;
    } else {
        return Math.min(Math.sin(angleCAB) * countDistance(point, edgeA), Math.sin(angleCBA) * countDistance(point, edgeB));
    }

    /*
    } else if (angleCAB > 1.61) {
        return Math.sin(angleCBA) * countDistance(point, edgeB);
    } else if (angleCBA > 1.61) {
        return Math.sin(angleCAB) * countDistance(point, edgeA);
    */
}

function countDistance(pointA, pointB) {
    // Výpočet vzdialenosti pomocou Haversine formuly
    const R = 6371e3;
    let lat_1_rad = pointA[0] * Math.PI / 180;
    let lat_2_rad = pointB[0] * Math.PI / 180;
    let delta_1 = (pointB[0] - pointA[0]) * Math.PI / 180;
    let delta_2 = (pointB[1] - pointA[1]) * Math.PI / 180;

    let a = Math.sin(delta_1 / 2) * Math.sin(delta_1 / 2) + Math.cos(lat_1_rad) * Math.cos(lat_2_rad) *
        Math.sin(delta_2 / 2) * Math.sin(delta_2 / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return(R * c);
}

function getAngle(x, y, z) {
    let x_y = Math.sqrt(Math.pow(y[0] - x[0], 2)+ Math.pow(y[1] - x[1], 2));
    let y_z = Math.sqrt(Math.pow(y[0] - z[0], 2)+ Math.pow(y[1] - z[1], 2));
    let x_z = Math.sqrt(Math.pow(z[0] - x[0], 2)+ Math.pow(z[1] - x[1], 2));

    return Math.acos((y_z * y_z + x_y * x_y - x_z * x_z) / (2 * y_z * x_y));
}

async function decode(db, codes, layer) {
    let result = [];
    for (let i = 0; i < codes.length; i++) {
        try {
            response = await db.query("SELECT geom, ST_AsGeoJSON(geom) FROM " + tables[layer] +
            " WHERE gid=" + codes[i]);
        } catch(err) {
            console.log(err);
            return false;
        }

        if (response.rows === undefined) {
            continue;
        }

        result.push(JSON.parse(response.rows[0].st_asgeojson).coordinates);
    }

    return result;
}

module.exports = { computeRoute };