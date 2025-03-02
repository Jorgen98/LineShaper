/*
 * API Main File
 */

const express = require('express');
const dotenv = require('dotenv');
const app = express();
const cors = require('cors');
const Pool = require('pg').Pool;
const jwt = require('jsonwebtoken');
const auth = require('basic-auth');

// .env file include
dotenv.config();
// CORS setup
app.use(cors());

// JWT secret string
const secret = require('crypto').randomBytes(256).toString('base64');

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
});

const apiBaseUrl = '/lineShaper/api/';

// Get new JWT for user:password
app.get(apiBaseUrl + 'login', async (req, res) => {
    verifyCredentials(req, res);
    });

// Current DB stats
app.get(apiBaseUrl + 'mapStats', verifyToken, async (req, res) => {
    res.send(await dbPoint.getStats(db));
    });

// Delete one transport mode layer from DB
app.delete(apiBaseUrl + 'layer', verifyEditorToken, async (req, res) => {
    res.send(await dbPoint.deleteLayer(db, req.query));
    });

// Map points CRUD operations
app.get(apiBaseUrl + 'mapPoint', verifyEditorToken, async (req, res) => {
        res.send(await dbPoint.getPoint(db, req.query));
    })
    .post(apiBaseUrl + 'mapPoint', verifyEditorToken, async (req, res) => {
        res.send(await dbPoint.createPoint(db, req.query));
    })
    .put(apiBaseUrl + 'mapPoint', verifyEditorToken, async (req, res) => {
        res.send(await dbPoint.updatePoint(db, req.query));
    })
    .delete(apiBaseUrl + 'mapPoint', verifyEditorToken, async (req, res) => {
        res.send(await dbPoint.deletePoint(db, req.query));
    });

// Used when uploading whole layer data
app.post(apiBaseUrl + 'createPoints', verifyEditorToken, async (req, res) => {
        res.send(await dbPoint.createPoints(db, req.query));
    })

// Get all features(stops, net points, waypoint ...) around some coordinates
app.get(apiBaseUrl + 'pointsInRad', verifyToken, async (req, res) => {
        res.send(await dbPoint.getPointsInRad(db, req.query));
    })

// Used in export use case
app.get(apiBaseUrl + 'pointsByGid', verifyEditorToken, async (req, res) => {
        if (process.env.NO_DOWNLOAD) {
            res.send([]);
        } else {
            res.send(await dbPoint.getPointsByGID(db, req.query));
        }
    })

// Change direction of net section between two crossings
app.put(apiBaseUrl + 'changeDirection', verifyEditorToken, async (req, res) => {
        res.send(await dbPoint.changeDirection(db, req.query));
    })

// Delete whole section between two crossings
app.delete(apiBaseUrl + 'section', verifyEditorToken, async (req, res) => {
    res.send(await dbPoint.deleteSection(db, req.query));
})

// Clean data in stop, line or line code tables
app.post(apiBaseUrl + 'clearRoutingData', verifyRouterToken, async (req, res) => {
    res.send(await dbRoutingData.clearData(db, req.query));
})

// Import stop data
app.post(apiBaseUrl + 'createStops', verifyRouterToken, async (req, res) => {
    res.send(await dbRoutingData.createStops(db, req.query));
})

// Import line data
app.post(apiBaseUrl + 'saveLines', verifyRouterToken, async (req, res) => {
    res.send(await dbRoutingData.saveLines(db, req.query));
})

// Import line codes data
app.post(apiBaseUrl + 'saveLineCodes', verifyRouterToken, async (req, res) => {
    res.send(await dbRoutingData.saveLineCodes(db, req.query));
})

// Get stop and its info around some point
app.get(apiBaseUrl + 'stopsInRad', verifyToken, async (req, res) => {
    res.send(await dbRoutingData.getStopsInRad(db, req.query));
})

// Get lines info
app.get(apiBaseUrl + 'lines', verifyRouterToken, async (req, res) => {
    res.send(await dbRoutingData.getLines(db, req.query));
})

// Get route based on stop codes
app.get(apiBaseUrl + 'route', verifyRouterToken, async (req, res) => {
    res.send(await dbRoutingData.getRoute(db, req.query));
})

// Get whole line route based on its code and direction
app.get(apiBaseUrl + 'lineRoute', verifyRouterToken, async (req, res) => {
    res.send(await dbRoutingData.getLineRoute(db, req.query));
})

// Get whole line route info based on its code and direction
app.get(apiBaseUrl + 'lineRouteInfo', verifyRouterToken, async (req, res) => {
    res.send(await dbRoutingData.getLineRouteInfo(db, req.query));
})

// Update line's route structure based on its code and direction
app.get(apiBaseUrl + 'updateLineRouteInfo', verifyRouterToken, async (req, res) => {
    res.send(await dbRoutingData.updateLineRouteInfo(db, req.query));
})

// Get info about all line routes based on its code
app.get(apiBaseUrl + 'lineRoutesInfo', verifyRouterToken, async (req, res) => {
    res.send(await dbRoutingData.getLineRoutesInfo(db, req.query));
})

// Start routing process for all lines
app.get(apiBaseUrl + 'routing', verifyRouterToken, async (req, res) => {
    res.send(await dbRoutingData.routing(db, req.query));
})

// Download computed route, which is saved in DB
app.get(apiBaseUrl + 'routedLine', verifyRouterToken, async (req, res) => {
    res.send(await dbRoutingData.getRoutedLine(db, req.query));
})

// Mid points CRUD operations
app.get(apiBaseUrl + 'midPoint', verifyRouterToken, async (req, res) => {
    res.send(await dbMidPoint.getMidPointByOneStopCode(db, req.query.endCodeA));
    })
    .post(apiBaseUrl + 'midPoint', verifyRouterToken, async (req, res) => {
        res.send(await dbMidPoint.createMidPoint(db, req.query));
    })
    .put(apiBaseUrl + 'midPoint', verifyRouterToken, async (req, res) => {
        res.send(await dbMidPoint.updateMidPoint(db, req.query));
    })
    .delete(apiBaseUrl + 'midPoint', verifyRouterToken, async (req, res) => {
        res.send(await dbMidPoint.deleteMidPoint(db, req.query));
    });

// Get existing midpoints around some point
app.get(apiBaseUrl + 'midPointsInRad', verifyToken, async (req, res) => {
    res.send(await dbMidPoint.getMidPointsInRad(db, req.query));
})

// Used in export use case
app.get(apiBaseUrl + 'midPointsByGid', verifyRouterToken, async (req, res) => {
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

// JWT verification functions
// Verify user:password if new token can be returned
function verifyCredentials(req, res, next) {
    const user = auth.parse(req.header('Authorization'));
    if (req.query.type === 'editor') {
        if (process.env.EDITOR_AUTH) {
            let editorUsers;
            try {
                editorUsers = JSON.parse(process.env.EDITOR_USERS);
            } catch(err) {
                editorUsers = {};
            }
            if (editorUsers[user['name']] === user['pass']) {
                res.send(JSON.stringify(jwt.sign('editor', secret)));
                return;
            } else {
                res.status(401).json({ error: 'Wrong name or password' });
                return;
            }
        } else {
            res.send(JSON.stringify(jwt.sign('editor', secret)));
        }
    } else if (req.query.type === 'router') {
        if (process.env.ROUTER_AUTH) {
            let routerUsers;
            try {
                routerUsers = JSON.parse(process.env.ROUTER_USERS);
            } catch(err) {
                routerUsers = {};
            }
            if (routerUsers[user['name']] === user['pass']) {
                res.send(JSON.stringify(jwt.sign('router', secret)));
                return;
            } else {
                res.status(401).json({ error: 'Wrong name or password' });
                return;
            }
        } else {
            res.send(JSON.stringify(jwt.sign('router', secret)));
        }
    }
}

// Verify token for editor exclusive API endpoints
function verifyEditorToken(req, res, next) {
    const token = req.header('Authorization');
    if (!token) {
        return res.status(401).json({ error: 'Access denied' })
    }
    try {
        if ('editor' === jwt.verify(token, secret)) {
            next();
        } else {
            res.status(401).json({ error: 'Invalid token' });
        }
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Verify token for router exclusive API endpoints
function verifyRouterToken(req, res, next) {
    const token = req.header('Authorization');
    if (!token) {
        return res.status(401).json({ error: 'Access denied' })
    }
    try {
        if ('router' === jwt.verify(token, secret)) {
            next();
        } else {
            res.status(401).json({ error: 'Invalid token' });
        }
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Verify token for API endpoint
function verifyToken(req, res, next) {
    const token = req.header('Authorization');
    if (!token) {
        return res.status(401).json({ error: 'Access denied' })
    }
    try {
        if ('editor' === jwt.verify(token, secret) ||
            'router' === jwt.verify(token, secret)) {
            next();
        } else {
            res.status(401).json({ error: 'Invalid token' });
        }
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};