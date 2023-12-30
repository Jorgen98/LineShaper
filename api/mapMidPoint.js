async function getMidPointByTwoStopCodes(db, endCodeA, endCodeB) {
    if (endCodeA === undefined || endCodeB === undefined) {
        return false;
    }

    let result, endStopA, endStopB;
    try {
        endStopA = await db.query("SELECT ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
            " WHERE code=" + parseInt(endCodeA.split('_')[0]) + " AND subcode='" + parseInt(endCodeA.split('_')[1]) + "'");
        endStopB = await db.query("SELECT ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
            " WHERE code=" + parseInt(endCodeB.split('_')[0]) + " AND subcode='" + parseInt(endCodeB.split('_')[1]) + "'");
    } catch(err) {
        console.log(err);
        return false;
    }

    if (endStopA.rows.length !== 1 || endStopB.rows.length !== 1) {
        return false;
    }

    try {
        result = await db.query("SELECT *, ST_AsGeoJSON(midpoints) FROM " + process.env.DB_MIDPOINTS_TABLE + " WHERE endCodeA='" + endCodeA + "' AND endCodeB='" + endCodeB + "'");
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

async function getMidPointByOneStopCode(db, endCodeA) {
    if (endCodeA === undefined) {
        return false;
    }

    let result, endStopA, endStopB;
    try {
        endStopA = await db.query("SELECT ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
            " WHERE code=" + parseInt(endCodeA.split('_')[0]) + " AND subcode='" + parseInt(endCodeA.split('_')[1]) + "'");
    } catch(err) {
        console.log(err);
        return false;
    }

    if (endStopA.rows.length !== 1) {
        return false;
    }

    try {
        result = await db.query("SELECT *, ST_AsGeoJSON(midpoints) FROM " + process.env.DB_MIDPOINTS_TABLE + " WHERE endCodeA='" + endCodeA + "'");
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
            endStopB = await db.query("SELECT ST_AsGeoJSON(geom) FROM " + process.env.DB_SIGNS_TABLE +
                " WHERE code=" + parseInt(result[i].endcodeb.split('_')[0]) + " AND subcode='" + parseInt(result[i].endcodeb.split('_')[1]) + "'");
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
        delete result[i].id;
    }

    return result;
}

async function createMidPoint(db, params) {
    if (params.endCodeA === undefined || params.endCodeB === undefined || params.midPoints === undefined) {
        return false;
    }

    let endStopA, endStopB;
    try {
        endStopA = await db.query("SELECT id FROM " + process.env.DB_SIGNS_TABLE +
            " WHERE code=" + parseInt(params.endCodeA.split('_')[0]) + " AND subcode='" + parseInt(params.endCodeA.split('_')[1]) + "'");
        endStopB = await db.query("SELECT id FROM " + process.env.DB_SIGNS_TABLE +
            " WHERE code=" + parseInt(params.endCodeB.split('_')[0]) + " AND subcode='" + parseInt(params.endCodeB.split('_')[1]) + "'");
    } catch(err) {
        console.log(err);
        return false;
    }

    if (endStopA.rows.length !== 1 || endStopB.rows.length !== 1) {
        return false;
    }
    
    let midPoints = JSON.parse(params.midPoints);

    if (midPoints.length === 0) {
        return false;
    }

    try {
        let result = await db.query("SELECT EXISTS (SELECT * FROM " + process.env.DB_MIDPOINTS_TABLE + " WHERE endCodeA='" +
            params.endCodeA + "' AND endCodeB='" + params.endCodeB + "')");
        if (result.rows[0].exists) {
            return false;
        }
    } catch(err) {
        console.log(err);
        return false;
    }

    try {
        let id = await db.query("INSERT INTO " + process.env.DB_MIDPOINTS_TABLE +
        " (endCodeA, endCodeB, midpoints) VALUES ('" + params.endCodeA + "', '" + params.endCodeB + "', '{" + '"type": "LineString", "coordinates": ' + params.midPoints + "}') RETURNING id");
        return id.rows[0];
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function updateMidPoint(db, params) {
    if (params.endCodeA === undefined || params.endCodeB === undefined || params.midPoints === undefined) {
        return false;
    }

    try {
        let result = await db.query("SELECT EXISTS (SELECT * FROM " + process.env.DB_MIDPOINTS_TABLE + " WHERE endCodeA='" +
            params.endCodeA + "' AND endCodeB='" + params.endCodeB + "')");
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
        await db.query("UPDATE " + process.env.DB_MIDPOINTS_TABLE + " SET midpoints='{" + '"type": "LineString", "coordinates": ' + params.midPoints + "}' WHERE endCodeA='" +
            params.endCodeA + "' AND endCodeB='" + params.endCodeB + "'");
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function deleteMidPoint(db, params) {
    if (params.endCodeA === undefined || params.endCodeB === undefined) {
        return false;
    }

    try {
        let result = await db.query("SELECT EXISTS (SELECT * FROM " + process.env.DB_MIDPOINTS_TABLE + " WHERE endCodeA='" +
        params.endCodeA + "' AND endCodeB='" + params.endCodeB + "')");
        if (!result.rows[0].exists) {
            return false;
        }
    } catch(err) {
        console.log(err);
        return false;
    }

    try {
        await db.query("DELETE FROM " + process.env.DB_MIDPOINTS_TABLE + " WHERE endCodeA='" +
        params.endCodeA + "' AND endCodeB='" + params.endCodeB + "'");
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

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

module.exports = { getMidPointByTwoStopCodes, getMidPointByOneStopCode, createMidPoint, updateMidPoint, deleteMidPoint, getMidPointsByID };