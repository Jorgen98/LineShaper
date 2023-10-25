let tables = {
    'rail': process.env.DB_RAIL_TABLE,
    'road': process.env.DB_ROAD_TABLE,
    'tram': process.env.DB_TRAM_TABLE
}

async function getPoint(db, params) {
    let result;
    if (params.gid === undefined || params.gid === "") {
        return false;
    }

    if (tables[params.layer] === undefined) {
        return false;
    }

    try {
        result = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + tables[params.layer] + " WHERE gid='" + params.gid + "'");
    } catch(err) {
        console.log(err);
        return false;
    }

    if (result.rows.length !== 1) {
        return false;
    }
    result = result.rows[0];
    result['geom'] = JSON.parse(result['st_asgeojson']).coordinates;
    delete result['st_asgeojson'];

    return result;
}

async function createPoint(db, params) {
    if (params.geom === undefined) {
        return false;
    }

    if (tables[params.layer] === undefined) {
        return false;
    }

    if (params.conns === undefined) {
        return false;
    }

    let point = "'{" + '"type": "Point", "coordinates": ' + params.geom + "}'";

    params.conns += "::integer[]";

    try {
        let gid = await db.query("INSERT INTO " + tables[params.layer] +
        ' (geom, conns) VALUES (' + point + ", ARRAY " + params.conns + ") RETURNING gid");
        return gid.rows[0];
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function createPoints(db, params) {
    if (tables[params.layer] === undefined) {
        return false;
    }

    if (params.hubs === undefined) {
        return false;
    }

    let query = "";
    let data = JSON.parse(params.hubs);

    for (let i = 0; i < data.length; i++) {
        if (data[i]["p"] === undefined) {
            continue;
        }
    
        if (data[i]["n"] === undefined) {
            continue;
        }
    
        let point = "('{" + '"type": "Point", "coordinates": ' + JSON.stringify(data[i]["p"]) + "}'";
        query += point + ", ARRAY " + JSON.stringify(data[i]["n"]) + "::integer[])";

        if (data.length > 0 && i < (data.length - 1)) {
            query += ",";
        }
    }

    try {
        await db.query("INSERT INTO " + tables[params.layer] +
        ' (geom, conns) VALUES ' + query);
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function updatePoint(db, params) {
    if (params.gid === undefined) {
        return false;
    }

    if (tables[params.layer] === undefined) {
        return false;
    }

    try {
        let result = await db.query("SELECT EXISTS (SELECT * FROM " + tables[params.layer] + " WHERE gid='" + params.gid + "')");
        if (!result.rows[0].exists) {
            return false;
        }
    } catch(err) {
        console.log(err);
        return false;
    }

    let query = "";
    if (params.geom !== undefined) {
        query += "geom='{" + '"type": "Point", "coordinates": ' + params.geom + "}'";
    }

    if (params.conns !== undefined) {
        if (params.geom !== undefined) {
            query += ",";
        }
        query += "conns=ARRAY " + params.conns + "::integer[]";
    }

    try {
        await db.query("UPDATE " + tables[params.layer] + " SET " + query + " WHERE gid='" + params.gid + "'");
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function deletePoint(db, params) {
    if (params.gid === undefined) {
        return false;
    }

    if (tables[params.layer] === undefined) {
        return false;
    }

    try {
        let result = await db.query("SELECT EXISTS (SELECT * FROM " + tables[params.layer] + " WHERE gid='" + params.gid + "')");
        if (!result.rows[0].exists) {
            return false;
        }
    } catch(err) {
        console.log(err);
        return false;
    }

    try {
        await db.query("DELETE FROM " + tables[params.layer] + " WHERE gid='" + params.gid + "'");
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function getPointsInRad(db, params) {
    if (tables[params.layer] === undefined || params.geom === undefined) {
        return false;
    }

    let point = JSON.parse(params.geom);

    if (point[0] === undefined || point[1] === undefined ) {
        return false;
    }

    try {
        let result = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + tables[params.layer] +
        " WHERE ST_DistanceSphere(geom, ST_MakePoint(" + point[0] + "," + point[1] + ")) <= 400");

        for (let i = 0; i < result.rows.length; i++) {
            result.rows[i] = result.rows[i];
            result.rows[i]['geom'] = JSON.parse(result.rows[i]['st_asgeojson']).coordinates;
            delete result.rows[i]['st_asgeojson'];
        }
        return result.rows;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function deleteLayer(db, params) {
    if (tables[params.layer] === undefined) {
        return false;
    }

    try {
        await db.query("TRUNCATE TABLE " + tables[params.layer] + " RESTART IDENTITY");
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function getPointsByGID(db, params) {
    if (tables[params.layer] === undefined) {
        return false;
    }

    if (params.gid === undefined) {
        return false;
    }

    try {
        let result = await db.query("SELECT *, ST_AsGeoJSON(geom) FROM " + tables[params.layer] +
        " WHERE gid > " + parseInt(params.gid) + " ORDER BY gid LIMIT (1000)");

        for (let i = 0; i < result.rows.length; i++) {
            result.rows[i]['geom'] = JSON.parse(result.rows[i]['st_asgeojson']).coordinates;
            delete result.rows[i]['st_asgeojson'];
        }
        return result.rows;
    } catch(err) {
        console.log(err);
        return false;
    }
}

async function getStats(db) {
    let stats = {};
    let keys = Object.keys(tables);

    for (let i = 0; i < 3; i++) {
        try {
            let result = await db.query("SELECT COUNT(gid) FROM " + tables[keys[i]]);
            stats[keys[i]] = parseInt(result.rows[0].count);
        } catch(err) {
            console.log(err);
            return false;
        }
    }
    
    return stats;
}

async function changeDirection(db, params) {
    if (tables[params.layer] === undefined) {
        return false;
    }

    if (params.gidA === undefined || params.gidB === undefined) {
        return false;
    }

    if (params.mode === undefined) {
        params.mode = 1;
    }

    let result = [];
    params.gidA = parseInt(params.gidA);
    params.gidB = parseInt(params.gidB);
    result.push(params.gidA);
    result.push(params.gidB);

    let connected = false;
    if ((await db.query("SELECT gid, conns FROM " + tables[params.layer] + " WHERE gid='" + params.gidA + "'")).rows[0].conns.indexOf(params.gidB) !== -1) {
        connected = true;
    }
    if ((await db.query("SELECT gid, conns FROM " + tables[params.layer] + " WHERE gid='" + params.gidB + "'")).rows[0].conns.indexOf(params.gidA) !== -1) {
        connected = true;
    }

    if (!connected) {
        return false;
    }

    await next(db, params.layer, params.gidA, result);
    await next(db, params.layer, params.gidB, result);

    for (let i = 0; i < result.length; i++) {
        let point = (await db.query("SELECT gid, conns FROM " + tables[params.layer] + " WHERE gid='" + result[i] + "'")).rows[0];

        if (i > 0 && point.conns.indexOf(result[i - 1]) !== -1) {
            point.conns.splice(point.conns.indexOf(result[i - 1]), 1);
        }
        if (i > 0 && params.mode == 0) {
            point.conns.push(result[i - 1]);
        }

        if (i < (result.length - 1) && point.conns.indexOf(result[i + 1]) !== -1) {
            point.conns.splice(point.conns.indexOf(result[i + 1]), 1);
        }
        if (i < (result.length - 1)) {
            point.conns.push(result[i + 1]);
        }

        try {
            await db.query("UPDATE " + tables[params.layer] + " SET conns=ARRAY " + JSON.stringify(point.conns) + "::integer[] WHERE gid='" + point.gid + "'");
        } catch(err) {
            console.log(err);
            return false;
        }
    }

    connected = false;
    if ((await db.query("SELECT gid, conns FROM " + tables[params.layer] + " WHERE gid='" + result[0] + "'")).rows[0]
        .conns.indexOf(result[result.length - 1]) !== -1) {
        connected = true;
    }
    if ((await db.query("SELECT gid, conns FROM " + tables[params.layer] + " WHERE gid='" + result[result.length - 1] + "'")).rows[0]
        .conns.indexOf(result[0]) !== -1) {
        connected = true;
    }

    if (connected && result.length > 2) {
        let pointA = (await db.query("SELECT gid, conns FROM " + tables[params.layer] + " WHERE gid='" + result[0] + "'")).rows[0];
        let pointB = (await db.query("SELECT gid, conns FROM " + tables[params.layer] + " WHERE gid='" + result[result.length - 1] + "'")).rows[0];

        if (pointA.conns.indexOf(result[result.length - 1]) !== -1) {
            pointA.conns.splice(pointA.conns.indexOf(result[result.length - 1]), 1);
        }
        if (pointB.conns.indexOf(result[0]) !== -1) {
            pointB.conns.splice(pointB.conns.indexOf(result[0]), 1);
        }

        if (params.mode == 0) {
            pointA.conns.push(result[result.length - 1]);
        }
        pointB.conns.push(result[0]);

        try {
            await db.query("UPDATE " + tables[params.layer] + " SET conns=ARRAY " + JSON.stringify(pointA.conns) +
                "::integer[] WHERE gid='" + pointA.gid + "'");
        } catch(err) {
            console.log(err);
            return false;
        }

        try {
            await db.query("UPDATE " + tables[params.layer] + " SET conns=ARRAY " + JSON.stringify(pointB.conns) +
                "::integer[] WHERE gid='" + pointB.gid + "'");
        } catch(err) {
            console.log(err);
            return false;
        }
    }

    return true;
}

async function next(db, layer, gid, result) {
    let conns = [];
    let forwardPoint = (await db.query("SELECT gid, conns FROM " + tables[layer] + " WHERE gid='" + gid + "'")).rows[0];
    if (forwardPoint === undefined) {
        return;
    }
    conns = conns.concat(forwardPoint.conns);

    let backwardPoint = await db.query("SELECT gid, conns FROM " + tables[layer] + " WHERE '" + gid + "'= ANY (conns)");
    for (let i = 0; i < backwardPoint.rows.length; i++) {
        if (conns.indexOf(backwardPoint.rows[i].gid) === -1) {
            conns.push(backwardPoint.rows[i].gid);
        }
    }

    let runs = 0;
    for (let i = 0; i < conns.length;) {
        if (result.indexOf(conns[i]) !== -1) {
            conns.splice(i, 1);
            runs += 1;
        } else {
            i++
        }
    }

    if (runs > 1) {
        return;
    }

    if (conns.length === 1) {
        if (result.indexOf(gid) === (result.length - 1)) {
            result.push(conns[0]);
        } else {
            result.unshift(conns[0]);
        }
        await next(db, layer, conns[0], result);
    }
}

module.exports = { getPoint, createPoint, updatePoint, deletePoint, getPointsInRad, getStats, deleteLayer, getPointsByGID, createPoints, changeDirection };