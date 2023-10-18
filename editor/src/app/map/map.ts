import { Component } from '@angular/core';
import * as L from 'leaflet';
import { MapService } from './map.service';
import { DataService } from '../data.service';

@Component({
    selector: 'map-component',
    templateUrl: './map.html',
    styleUrls: ['./map.css']
})

export class MapComponent {
    private map!: L.Map;
    private tiles = {
        "min_zoom": 7,
        "max_zoom": 19,
        "tiles": [
        {
            "layer": 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            "attribution": '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        },
        {
            "layer": 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
            "attribution": '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
        {
            "layer": 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            "attribution": '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
        ]
    };
    private tilesLayer: any;
    private featuresLayer: any;
    private curObjects: any = {};
    private curConns: any = {};
    private layers: any = {
        'points': undefined,
        'lines': undefined
    }

    private defaultObjStyle =  {
        radius: 1.5,
        fillColor: "var(--black)",
        color: "var(--black)",
        opacity: 1,
        weight: 2,
        fillOpacity: 1
    }

    private directionIcon = L.icon({
        iconUrl: 'assets/icons/direction.svg',
        iconSize:     [24, 24],
        iconAnchor:   [12, 12],
        className: 'dirIcon'
    });

    private initMap(): void {
        this.map = L.map('map', {
            center: [49.195629, 16.613396],
            zoom: 13,
            zoomControl: false
        });

        this.setTiles(this.dataService.getTitleIndex());
        let t = this;
        this.map.on('dragend', function(event) {
            t.loadContext(t.map.getCenter());
        })
    }

    constructor(private mapService: MapService, private dataService: DataService) {
        this.mapService.zoomInEvent().subscribe(() => {
            this.map.zoomIn();
        })

        this.mapService.zoomOutEvent().subscribe(() => {
            this.map.zoomOut();
        })

        this.mapService.changeBaseMapEvent().subscribe((id) => {
            this.setTiles(id);
        })

        this.dataService.layerChange().subscribe(() => {
            this.loadContext(this.map.getCenter());
        })
    }

    async ngAfterViewInit() {
        this.initMap();
    }

    setTiles(id: number): void {
        let t = this;
        if (this.tilesLayer !== undefined) {
            this.map.removeLayer(this.tilesLayer);
        }

        this.tilesLayer = L.tileLayer(this.tiles.tiles[id].layer, {
            maxZoom: this.tiles.max_zoom,
            minZoom: this.tiles.min_zoom,
            attribution: this.tiles.tiles[id].attribution
        })
        .addTo(this.map);

        this.dataService.setTitleIndex(id);
    }

    createKey(gidA: number, gidB: number) {
        if (gidA < gidB) {
            return gidA.toString() + '_' + gidB.toString();
        } else if (gidA > gidB) {
            return gidB.toString() + '_' + gidA.toString();
        } else {
            return false;
        }
    }

    createDirectionRectangle(center: {"lat": number, "lng": number}, angle: number) {
        let triangleSize = 0.00003;
        let vertA = this.rotatePoint(center, {"lat": center.lat - triangleSize, "lng": center.lng}, angle);
        let vertB = this.rotatePoint(center, {"lat": center.lat - triangleSize, "lng": center.lng}, angle + 240);
        let vertC = this.rotatePoint(center, {"lat": center.lat - triangleSize, "lng": center.lng}, angle + 120);

        let triangle = L.polygon([vertA, vertB, vertC]).addTo(this.layers["lines"]);
        triangle.bringToBack();
    }

    rotatePoint(center:any, point:any, angle:any) {
        const centerPoint = this.map.latLngToLayerPoint(center);
        angle = angle * (Math.PI / 180);

        const p = this.map.latLngToLayerPoint(point);
        const p2 = new L.Point(p.x - centerPoint.x, p.y - centerPoint.y);
        const p3 = new L.Point(Math.cos(angle) * p2.x - Math.sin(angle) * p2.y, Math.sin(angle) * p2.x + Math.cos(angle) * p2.y);
        let p4 = new L.Point(p3.x + centerPoint.x, p3.y + centerPoint.y);

        return this.map.layerPointToLatLng(p4)
    }

    async loadContext(latLng: L.LatLng) {
        if (this.layers['points'] !== undefined) {
            this.map.removeLayer(this.layers['points']);
        }
        this.layers['points'] = L.layerGroup();
        this.layers['points'].addTo(this.map);

        if (this.layers['lines'] !== undefined) {
            this.map.removeLayer(this.layers['lines']);
        }
        this.layers['lines'] = L.layerGroup();
        this.layers['lines'].addTo(this.map);

        this.curObjects = {};
        this.curConns = {};

        let response = await this.dataService.getPointsInRad([latLng.lat, latLng.lng]);
        for (let i = 0; i < response.length; i++) {
            this.curObjects[response[i].gid] = null;
        }
        for (let i = 0; i < response.length; i++) {
            let conns = [];
            for (let j = 0; j < response[i].conns.length; j++) {
                if (this.curObjects[response[i].conns[j]] === undefined) {
                    continue;
                }

                let key = this.createKey(response[i].gid, response[i].conns[j]);

                if (!key) {
                    continue;
                }

                // new connection, can be one way in result
                if (this.curConns[key] === undefined) {
                    this.curConns[key] = {'t': 0, 'a': response[i].gid, 'b': response[i].conns[j], 'line': undefined};
                // there is already reverse connection, cur connection will be two way in result
                } else {
                    this.curConns[key].t = 1;
                }

                conns.push(key);
            }
            this.curObjects[response[i].gid] = {"conns": conns, "point": undefined};
            this.createPoint(response[i].geom, response[i].gid);
        }

        let keys = Object.keys(this.curConns);
        for (let i = 0; i < keys.length; i++) {
            this.createLine(keys[i]);
        }
    }

    createPoint(latLng: L.LatLng, gid: number) {
        let t = this;
        let point = L.circle(latLng, this.defaultObjStyle)
            .addTo(this.layers['points'])
            .on('click', (event) => {
                console.log(t.curObjects[gid])
                L.DomEvent.stop(event);
            })
            .on('mousedown', (event) => {
                L.DomEvent.stop(event);
            })
            .on('mouseup', (event) => {
                L.DomEvent.stop(event);
            });
        this.curObjects[gid].point = point;
    }

    createLine(key: string) {
        let line = this.curConns[key];
        let pointA = this.curObjects[line.a].point;
        let pointB = this.curObjects[line.b].point;
        if (pointA === undefined || pointB === undefined) {
            return;
        }

        let t = this;
        let newLine = L.polyline([pointA.getLatLng(), pointB.getLatLng()], this.defaultObjStyle)
        .addTo(this.layers['lines'])
        .on('click', (event) => {
            L.DomEvent.stop(event);
        })
        line.line = newLine;

        if (line.t === 0) {
            L.circle({"lat": pointA.getLatLng().lat, "lng": pointB.getLatLng().lng}, this.defaultObjStyle).addTo(this.layers['lines']);
            let length_a = pointA.getLatLng().distanceTo({"lat": pointA.getLatLng().lat, "lng": pointB.getLatLng().lng});
            let length_b = pointA.getLatLng().distanceTo(pointB.getLatLng());
            let angle =  Math.asin(length_a / length_b) * (180 / Math.PI);
            console.log(key, angle)
            if ((pointA.getLatLng().lng - pointB.getLatLng().lng) < 0) {
                angle += 180;
            }
            this.createDirectionRectangle(line.line.getCenter(), 0);
        }
    }
}
