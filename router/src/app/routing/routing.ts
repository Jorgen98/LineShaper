import { Component, Input, OnInit } from '@angular/core';
import { DataService } from '../data.service';
import { MapService } from '../map/map.service';

@Component({
    selector: 'routing',
    templateUrl: './routing.html',
    styleUrls: ['./routing.css']
})

export class RoutingComponent implements OnInit {
    constructor(private dataService: DataService, private mapService: MapService) {
        this.mapService.onStopClickEvent().subscribe((stop) => {
            if (this.stops.length === 0 || this.stops[0].label !== stop.label.toString()) {
                this.stops.push(stop);
            }

            if (this.state === 'stopToStop0' || this.state === 'stopToStop1' || this.state === 'stopToStopWarning') {
                this.routeStopToStop();
            }
        })
    }
    state = 'menu';
    curLine = '';
    curLines: any = [];
    curDir = '';
    curLineEnds: any = [];
    progress = 0;
    progressText = '';
    routing = false;
    stops: any = [];

    async ngOnInit() {
        this.curLines = await this.dataService.getLinesInfo();

        if (this.curLines.length > 0) {
            this.curLine = this.curLines[0].code;

            this.setLineEnds();
        }
    }

    async defaultMenu() {
        this.state = 'menu';
        this.routing  = false;
    }

    async routeOneLine() {
        if (this.state !== 'routeOneLine') {
            this.state = 'routeOneLine';
            return;
        }
        
        this.mapService.onRouting(true);
        this.state = 'routingProgress';

        let route;
        let round = 0;
        do {
            route = await this.dataService.getWholeLine(parseInt(this.curLine), this.curDir);
            round++;
        } while (route.stops === undefined && round < 3);

        if (route.stops !== undefined) {
            this.mapService.putRouteOnMap(route);
        } else {
            console.log(this.curLine, this.curDir);
        }

        this.mapService.onRouting(false);
        this.defaultMenu();
    }

    setLineEnds() {
        let idx = this.curLines.map((e: { code: any; }) => e.code).indexOf(parseInt(this.curLine));
        this.curLineEnds = [];

        if (this.curLines[idx].routeB !== undefined) {
            this.curLineEnds.push({'name': this.curLines[idx].routeB.s + ' -> ' + this.curLines[idx].routeB.e, 'dir': 'b'});
            this.curDir = 'b';
        }

        if (this.curLines[idx].routeA !== undefined) {
            this.curLineEnds.unshift({'name': this.curLines[idx].routeA.s + ' -> ' + this.curLines[idx].routeA.e, 'dir': 'a'});
            this.curDir = 'a';
        }
    }

    async routeAllRoutes() {
        if (this.progress === 100) {
            this.progress = 0;
            this.defaultMenu();
            return;
        }
        const start = Date.now();
        this.state = 'progress';
        this.progress = 0;
        this.progressText = 'Probíhá výpočet tras. Vyčkejte prosím.';
        this.routing  = true;
        this.mapService.onRouting(true);

        let lines = await this.dataService.getLinesInfo();
        let result: any = {};

        for (let i = 0; i < lines.length; i++) {
            if (result[lines[i].code] === undefined) {
                result[lines[i].code] = {'a': [], 'b': []};
            }

            try {
                result[lines[i].code].a = (await this.dataService.getWholeLine(lines[i].code, 'a')).route;
            } catch(err) {
                console.log(err);
            }
            if (!this.routing) {
                break;
            }
            this.progress = Math.round(i / lines.length * 100);

            try {
                result[lines[i].code].b = (await this.dataService.getWholeLine(lines[i].code, 'b')).route;
            } catch(err) {
                console.log(err);
            }
            if (!this.routing) {
                break;
            }
            this.progress = Math.round((i + 0.5) / lines.length * 100);
        }

        if (this.routing) {
            this.getShapeFile(0, lines, result);
            this.getShapeFile(1, lines, result);
        }

        const end = Date.now();
        console.log(`Routing time: ${(end - start) / 1000} s`);

        if (this.routing) {
            this.progressText = "Exportování dat je dokončeno";
        } else {
            this.progressText = "Trasování linek bylo zrušeno";
        }
        this.progress = 100;
        this.mapService.onRouting(false);
    }

    cancelRouting() {
        this.routing = false;
        this.progressText = "Trasování linek bylo zrušeno. Vyčkejte prosím.";
        this.progress = 0;
    }

    getShapeFile(type: number = 0, lines: any, result: any) {
        this.progress = 0;
        let text = 'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\r\n';
        for (let i = 0; i < lines.length; i++) {
            if (result[lines[i].code] !== undefined) {
                let idx = 0;
                if (result[lines[i].code].a !== undefined && result[lines[i].code].a.length > 0) {
                    for (let j = 0; j < result[lines[i].code].a.length; j++) {
                        if (type === 0) {
                            text += lines[i].name;
                        } else {
                            text += 'L' + lines[i].code + 'D99';
                        }
                        text += ',' + result[lines[i].code].a[j][0] + ',' + result[lines[i].code].a[j][1] + ',' + idx + '\r\n';
                        idx++;
                    }
                }

                if (result[lines[i].code].b !== undefined && result[lines[i].code].b.length > 0) {
                    for (let j = 0; j < result[lines[i].code].b.length; j++) {
                        if (type === 0) {
                            text += lines[i].name;
                        } else {
                            text += 'L' + lines[i].code + 'D99';
                        }
                        text += ',' + result[lines[i].code].b[j][0] + ',' + result[lines[i].code].b[j][1] + ',' + idx + '\r\n';
                        idx++;
                    }
                }
            }
            this.progress = Math.round(i / lines.length * 100);
        }

        let filename;
        if (type === 0) {
            filename = "shapes.txt";
        } else {
            filename = "GTFS_shapes.txt";
        }

        let blob = new Blob([text], { type: 'text' });

        let a = document.createElement("a");
        document.body.appendChild(a);
        a.setAttribute('download', filename);
        a.style.display = 'none';
        a.href = window.URL.createObjectURL(blob);
        a.download = filename;
        a.click();
    }

    stopToStopRoutingStart() {
        this.state = 'stopToStop0';
        this.stops = [];
    }

    async routeStopToStop(transportMode: string = "") {
        if (this.stops.length === 1 && this.state === 'stopToStop0') {
            this.state = 'stopToStop1';
            return;
        } else if (this.stops.length === 1) {
            this.state = 'stopToStopWarning';
            return;
        }

        if (this.stops.length === 2) {
            if (transportMode !== "") {
                this.mapService.onRouting(true);
                this.state = 'routingProgress';

                let route = await this.dataService.getRoute([this.stops[0].keys[0], this.stops[1].keys[0]], transportMode);

                if (!route) {
                    this.defaultMenu();
                    return;
                }

                this.mapService.putRouteOnMap(route);
                this.mapService.onRouting(false);
            } else {
                this.state = 'stopToStop2';
                return;
            }
        } else {
            return;
        }
        
        this.defaultMenu();
    }
    
}
