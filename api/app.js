const express = require('express');
const dotenv = require('dotenv');
const app = express();
const cors = require('cors');
const Pool = require('pg').Pool;

// .env file include
dotenv.config();
// CORS setup
app.use(cors());

const dbPoint = require('./mapPoint.js');
const dbRoutingData = require('./routingData.js');
const dbMidPoint = require('./mapMidPoint.js');

// DB connection established
const db = new Pool({
    user: process.env.DB_USER,
    host: process.env.HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
  })

app.get('/api/mapStats', async (req, res) => {
    res.send(await dbPoint.getStats(db));
    });

app.delete('/api/layer', async (req, res) => {
    res.send(await dbPoint.deleteLayer(db, req.query));
    });

// Map points CRUD operations
app.get('/api/mapPoint', async (req, res) => {
        res.send(await dbPoint.getPoint(db, req.query));
    })
    .post('/api/mapPoint', async (req, res) => {
        res.send(await dbPoint.createPoint(db, req.query));
    })
    .put('/api/mapPoint', async (req, res) => {
        res.send(await dbPoint.updatePoint(db, req.query));
    })
    .delete('/api/mapPoint', async (req, res) => {
        res.send(await dbPoint.deletePoint(db, req.query));
    });

app.post('/api/createPoints', async (req, res) => {
        res.send(await dbPoint.createPoints(db, req.query));
    })

app.get('/api/pointsInRad', async (req, res) => {
        res.send(await dbPoint.getPointsInRad(db, req.query));
    })

app.get('/api/pointsByGid', async (req, res) => {
        res.send(await dbPoint.getPointsByGID(db, req.query));
    })

app.put('/api/changeDirection', async (req, res) => {
        res.send(await dbPoint.changeDirection(db, req.query));
    })

app.delete('/api/section', async (req, res) => {
    res.send(await dbPoint.deleteSection(db, req.query));
})

// Clean data in stop, line or line code tables
app.post('/api/clearRoutingData', async (req, res) => {
    res.send(await dbRoutingData.clearData(db, req.query));
})

// Import stop data
app.post('/api/createStops', async (req, res) => {
    res.send(await dbRoutingData.createStops(db, req.query));
})

// Import line data
app.post('/api/saveLines', async (req, res) => {
    res.send(await dbRoutingData.saveLines(db, req.query));
})

// Import line codes data
app.post('/api/saveLineCodes', async (req, res) => {
    res.send(await dbRoutingData.saveLineCodes(db, req.query));
})

// Get stop and its info around some point
app.get('/api/stopsInRad', async (req, res) => {
    res.send(await dbRoutingData.getStopsInRad(db, req.query));
})

// Get lines info
app.get('/api/lines', async (req, res) => {
    res.send(await dbRoutingData.getLines(db, req.query));
})

// Get route based on stop codes
app.get('/api/route', async (req, res) => {
    res.send(await dbRoutingData.getRoute(db, req.query));
})

// Get whole line route based on its code and direction
app.get('/api/lineRoute', async (req, res) => {
    res.send(await dbRoutingData.getLineRoute(db, req.query));
})

app.get('/api/lineRouteInfo', async (req, res) => {
    res.send(await dbRoutingData.getLineRouteInfo(db, req.query));
})

app.get('/api/updateLineRouteInfo', async (req, res) => {
    res.send(await dbRoutingData.updateLineRouteInfo(db, req.query));
})

app.get('/api/lineRoutesInfo', async (req, res) => {
    res.send(await dbRoutingData.getLineRoutesInfo(db, req.query));
})

app.get('/api/routing', async (req, res) => {
    res.send(await dbRoutingData.routing(db, req.query));
})

app.get('/api/routedLine', async (req, res) => {
    res.send(await dbRoutingData.getRoutedLine(db, req.query));
})

// Mid points CRUD operations
app.get('/api/midPoint', async (req, res) => {
    res.send(await dbMidPoint.getMidPointByOneStopCode(db, req.query.endCodeA));
    })
    .post('/api/midPoint', async (req, res) => {
        res.send(await dbMidPoint.createMidPoint(db, req.query));
    })
    .put('/api/midPoint', async (req, res) => {
        res.send(await dbMidPoint.updateMidPoint(db, req.query));
    })
    .delete('/api/midPoint', async (req, res) => {
        res.send(await dbMidPoint.deleteMidPoint(db, req.query));
    });

// Get existing midpoints around some point
app.get('/api/midPointsInRad', async (req, res) => {
    res.send(await dbMidPoint.getMidPointsInRad(db, req.query));
})

app.get('/api/midPointsByGid', async (req, res) => {
    res.send(await dbMidPoint.getMidPointsByID(db, req.query));
})

// Running API itself
app.listen(process.env.API_PORT, async () => {
    // Try to connect
    try {
        await db.connect();
    } catch(error) {
        console.log(error);
        return false;
    }

    // API is ready
    console.log(`App listening on port ${process.env.API_PORT}`);
})
