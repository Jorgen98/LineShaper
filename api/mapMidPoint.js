/*
 * API Waypoints handle functions
 */

// Get waypoint if exists between two stops
async function getMidPointByTwoStopCodes(db, endCodeA, endCodeB) {
    if (endCodeA === undefined || endCodeB === undefined) {
        return false;
    }

    // Verify if stops exists
    let result, endStopA, endStopB;
    try {
        endStopA = await db.query("SELECT ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
            " WHERE code=" + parseInt(endCodeA.split('_')[0]) + " AND '" + parseInt(endCodeA.split('_')[1]) + "'=ANY(subcodes)");
        endStopB = await db.query("SELECT ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
            " WHERE code=" + parseInt(endCodeB.split('_')[0]) + " AND '" + parseInt(endCodeB.split('_')[1]) + "'=ANY(subcodes)");
    } catch(err) {
        console.log(err);
        return false;
    }

    if (endStopA.rows.length !== 1 || endStopB.rows.length !== 1) {
        return false;
    }

    // Try to find waypoint between the stops
    try {
        result = await db.query("SELECT *, ST_AsGeoJSON(midpoints) FROM " + process.env.DB_MIDPOINTS_TABLE + " WHERE '" + endCodeA + "'=ANY(endCodesA) AND '" + endCodeB + "'=ANY(endCodesB)");
    } catch(err) {
        console.log(err);
        return false;
    }

    if (result.rows.length !== 1) {
        return false;
    }

    result = result.rows[0];
    delete result['id'];

    let points = [];
    let stops = [];

    // Compute waypoint codes from DB, this codes will be used in routing
    points = JSON.parse(result.st_asgeojson).coordinates;
    for (let i = 0; i < points.length; i++) {
        let point;

        try {
            point = await db.query("SELECT ST_MakePoint(" + points[i][0] + ", " + points[i][1] + ")");
        } catch(err) {
            console.log(err);
            return false;
        }

        if (point.rows[0] !== undefined && point.rows[0].st_makepoint) {
            stops.push(points[i]);
            points[i] = {'geom': point.rows[0].st_makepoint, 'specCode': '', 'pos': points[i]};
        } else {
            continue;
        }
    }

    return {'stopPoss': stops, 'points': points};
}

// Get all waypoints around some coords
async function getMidPointsInRad(db, params) {
    if (params.geom === undefined) {
        return false;
    }

    let point = JSON.parse(params.geom);

    if (point[0] === undefined || point[1] === undefined ) {
        return false;
    }

    let result, endStopA, endStopB

    try {
        result = await db.query("SELECT *, ST_AsGeoJSON(midpoints) FROM " + process.env.DB_MIDPOINTS_TABLE +
            " WHERE ST_DistanceSphere(midpoints, ST_MakePoint(" + point[0] + "," + point[1] + ")) <= 2000 " + 
            "ORDER BY ST_DistanceSphere(midpoints, ST_MakePoint(" + point[0] + "," + point[1] + "))" +
            "LIMIT 10");
    } catch(err) {
        console.log(err);
        return false;
    }

    if (result.rows.length === 0) {
        return false;
    }

    result = result.rows;

    for (let i = 0; i < result.length; i++) {
        let points = [];

        try {
            endStopA = await db.query("SELECT ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
                " WHERE code=" + parseInt(result[i].endcodesa[0].split('_')[0]) + " AND '" + parseInt(result[i].endcodesa[0].split('_')[1]) + "'=ANY(subcodes)");
            endStopB = await db.query("SELECT ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
                " WHERE code=" + parseInt(result[i].endcodesb[0].split('_')[0]) + " AND '" + parseInt(result[i].endcodesb[0].split('_')[1]) + "'=ANY(subcodes)");
        } catch(err) {
            console.log(err);
            return false;
        }
    
        if (endStopB.rows.length !== 1) {
            return false;
        }

        points.push(JSON.parse(endStopA.rows[0].st_asgeojson).coordinates);
        points = points.concat(JSON.parse(result[i].st_asgeojson).coordinates);
        points.push(JSON.parse(endStopB.rows[0].st_asgeojson).coordinates);
    
        result[i].points = points;
        delete result[i].geom;
        delete result[i].st_asgeojson;
        delete result[i].midpoints;
        delete result[i].endcodesa;
        delete result[i].endcodesb;
    }

    return result;
}

// Create new waypoint
async function createMidPoint(db, params) {
    if (params.endCodesA === undefined || params.endCodesB === undefined || params.midPoints === undefined) {
        return false;
    }

    let codesA = JSON.parse(params.endCodesA);
    let codesB = JSON.parse(params.endCodesB);

    if (!(await checkIfStopCodesExists(db, codesA)) || !(await checkIfStopCodesExists(db, codesB)) || !(await checkIfMidPointExists(db, codesA, codesB))) {
        return false;
    }
    
    let midPoints = JSON.parse(params.midPoints);

    if (midPoints.length === 0) {
        return false;
    }

    try {
        let id = await db.query("INSERT INTO " + process.env.DB_MIDPOINTS_TABLE +
        " (endCodesA, endCodesB, midpoints) VALUES (ARRAY " + params.endCodesA.replaceAll('"', "'") +
        ", ARRAY " + params.endCodesB.replaceAll('"', "'") + ", '{" + '"type": "LineString", "coordinates": ' + params.midPoints + "}') RETURNING id");
        return id.rows[0];
    } catch(err) {
        console.log(err);
        return false;
    }
}

// Check if waypoint exists
async function checkIfMidPointExists(db, codesA, codesB) {
    let query = "SELECT EXISTS (SELECT * FROM " + process.env.DB_MIDPOINTS_TABLE + " WHERE ";
    for (let i = 0; i < codesA.length; i++) {
        query += "'" + codesA[i] + "'=ANY(endCodesA)";
        query += " AND ";
    }

    for (let i = 0; i < codesB.length; i++) {
        query += "'" + codesB[i] + "'=ANY(endCodesB)";
        if (i < (codesB.length - 1)) {
            query += " AND ";
        }
    }

    query += ")";

    try {
        let result = await db.query(query);
        if (result.rows[0].exists) {
            return false;
        }
    } catch(err) {
        console.log(err);
        return false;
    }

    return true;
}

// Update waypoint
async function updateMidPoint(db, params) {
    if (params.id === undefined || params.midPoints === undefined) {
        return false;
    }

    try {
        let result = await db.query("SELECT EXISTS (SELECT * FROM " + process.env.DB_MIDPOINTS_TABLE + " WHERE id='" + params.id + "')");
        if (!result.rows[0].exists) {
            return false;
        }
    } catch(err) {
        console.log(err);
        return false;
    }

    let midPoints = JSON.parse(params.midPoints);

    if (midPoints.length === 0) {
        return false;
    }

    try {
        await db.query("UPDATE " + process.env.DB_MIDPOINTS_TABLE + " SET midpoints='{" + '"type": "LineString", "coordinates": ' + params.midPoints + "}' WHERE id='" + params.id + "'");
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

// Delete waypoint
async function deleteMidPoint(db, params) {
    if (params.id === undefined) {
        return false;
    }

    try {
        let result = await db.query("SELECT EXISTS (SELECT * FROM " + process.env.DB_MIDPOINTS_TABLE + " WHERE id='" + params.id + "')");
        if (!result.rows[0].exists) {
            return false;
        }
    } catch(err) {
        console.log(err);
        return false;
    }

    try {
        await db.query("DELETE FROM " + process.env.DB_MIDPOINTS_TABLE + " WHERE id='" + params.id + "'");
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

// Used in export, get waypoints from DB by ID range
async function getMidPointsByID(db, params) {
    if (params.id === undefined) {
        return false;
    }

    try {
        let result = await db.query("SELECT *, ST_AsGeoJSON(midpoints) FROM " + process.env.DB_MIDPOINTS_TABLE +
        " WHERE id > " + parseInt(params.id) + " ORDER BY id LIMIT (1000)");

        for (let i = 0; i < result.rows.length; i++) {
            result.rows[i]['midpoints'] = JSON.parse(result.rows[i]['st_asgeojson']).coordinates;
            delete result.rows[i]['st_asgeojson'];
        }
        return result.rows;
    } catch(err) {
        console.log(err);
        return false;
    }
}

// Check if stops exists
async function checkIfStopCodesExists(db, codes) {
    for (const stopCode of codes) {
        let stop;
        try {
            stop = await db.query("SELECT id FROM " + process.env.DB_SIGNS_TABLE +
                " WHERE code=" + parseInt(stopCode.split('_')[0]) + " AND '" + stopCode.split('_')[1] + "'=ANY(subcodes)");
        } catch(err) {
            console.log(err);
            return false;
        }

        if (stop.rows.length !== 1) {
            return false;
        }
    }

    return true;
}

module.exports = { getMidPointByTwoStopCodes, getMidPointsInRad, createMidPoint, updateMidPoint, deleteMidPoint, getMidPointsByID };