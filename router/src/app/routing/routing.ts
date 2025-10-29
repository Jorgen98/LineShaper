import { Component, Input, OnInit } from '@angular/core';
import { DataService } from '../data.service';
import { MapService } from '../map/map.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'routing',
    templateUrl: './routing.html',
    styleUrls: ['./routing.css'],
    standalone: false
})

export class RoutingComponent implements OnInit {
    constructor(private dataService: DataService, private mapService: MapService, private translate: TranslateService) {
        this.mapService.onStopClickEvent().subscribe((stop) => {
            if (this.stops.length === 0 || (this.stops[0].label !== stop.label.toString() && this.state !== 'stopToStopRes')) {
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
    transportMode = '';
    stops: any = [];
    routingState = {state: '', date: '', progress: 0};
    interval: any = undefined;
    dataAvailable: boolean = false;
    curRouteStops: any = [];
    alternativeRoutes: (string)[][] = [];

    async ngOnInit() {
        if (Object.keys(this.mapService.getWhatIsOnMap()['line']).length === 2) {
            this.state = 'routeOneLineRes';
            this.curLine = this.mapService.getWhatIsOnMap()['line'].lineCode;
            this.curDir = this.mapService.getWhatIsOnMap()['line'].dir;
        }

        if (Object.keys(this.mapService.getWhatIsOnMap()['stopToStop']).length === 2) {
            this.state = 'stopToStopRes';
            this.transportMode = this.mapService.getWhatIsOnMap()['stopToStop'].transportMode;
            this.stops = this.mapService.getWhatIsOnMap()['stopToStop'].stops;
        }

        this.curLines = await this.dataService.getLinesInfo();

        if (this.curLines.length > 0 && this.curLine === '') {
            this.curLine = this.curLines[0].value;
        }
        
        this.setLineEnds();

        if (Object.keys(this.mapService.getWhatIsOnMap()['line']).length === 2) {
            this.curLines.find((line: any) => {
                if (line.code === parseInt(this.curLine)) {
                    if (this.curDir === 'a') {
                        this.progressText = line.name + ': ' + line.routeA.s + ' -> ' + line.routeA.e;
                    } else {
                        this.progressText = line.name + ': ' + line.routeB.s + ' -> ' + line.routeB.e;
                    }
                }
            });
        }

        if (Object.keys(this.mapService.getWhatIsOnMap()['stopToStop']).length === 2) {
            this.progressText = this.stops[0].label + '->' + this.stops[1].label;
        }
    }

    defaultMenu() {
        this.state = 'menu';
        this.mapService.cleanWhatIsOnMap();
    }

    routeOneLine() {
        if (this.state !== 'routeOneLine') {
            this.state = 'routeOneLine';
            return;
        }
    }

    async getRoute() {
        this.mapService.onRouting(true);
        this.state = 'routingProgress';

        this.mapService.setWhatIsOnMap('line', {lineCode: this.curLine, dir: this.curDir});

        let route;
        let round = 0;
        do {
            route = await this.dataService.getWholeLine(parseInt(this.curLine), this.curDir);
            round++;
        } while (route.stops === undefined && round < 3);

        if (route.stops !== undefined) {
            this.mapService.putRouteOnMap(route);
        }

        this.mapService.onRouting(false);
        this.curLines.find((line: any) => {
            if (line.code === parseInt(this.curLine)) {
                if (this.curDir === 'a') {
                    this.progressText = line.name + ': ' + line.routeA.s + ' -> ' + line.routeA.e;
                } else {
                    this.progressText = line.name + ': ' + line.routeB.s + ' -> ' + line.routeB.e;
                }
            }
        });
        this.state = 'routeOneLineRes';
    }

    setLineEnds(l:any = undefined) {
        if (l !== undefined) {
            this.curLine = l.value;
        }

        if (this.curLine === '' || this.curLines.length < 1) {
            return;
        }

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

        this.mapService.setWhatIsOnMap('line', {lineCode: this.curLine, dir: this.curDir});
    }

    async routeAllRoutes() {
        this.routingState = await this.dataService.routing();
        this.state = 'routeAllRoutes';
        if (this.routingState.state === "no_data") {
            this.state = 'routeAllRoutes';
            return;
        } else if (this.routingState.state === "routing") {
            this.state = 'progress';
            this.routeAll();
            return;
        } else if (this.routingState.state === "data_available") {
            this.dataAvailable = true;
            let date = new Date(this.routingState.date);
            this.progressText = this.translate.instant('routing.dateValid') + '\n' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        } else {
            return;
        }
    }

    async routeAll() {
        this.state = 'progress';
        await this.dataService.routing(true);

        clearInterval(this.interval);
        this.interval = setInterval(() => this.renewProgress(), 5000);

        this.routing = true;
        if (this.routingState.progress > 1) {
            this.progress = this.routingState.progress;
        } else {
            this.progress = 1;
        }
        this.progressText = this.translate.instant('routing.progress.countingRoutes');
    }

    newRouteAll() {
        this.state = 'routeAllRoutesConfirm';
        this.progressText = this.translate.instant('routing.progress.rewrite');
    }

    async renewProgress() {
        this.routingState = await this.dataService.routing();
        if (this.routingState.state === 'routing' && this.routingState.progress !== -1) {
            if (this.routingState.progress > 1) {
                this.progress = this.routingState.progress;
            }
        } else {
            clearInterval(this.interval);
            this.routeAllRoutes();
        }
    }

    async cancelRouting() {
        this.routing = false;
        this.dataAvailable = false;
        this.routingState = await this.dataService.routing(false, true);
        this.progressText = this.translate.instant('routing.progress.cancel');
    }

    async downloadData() {
        let lines = await this.dataService.getLinesInfo();
        let result: any = {};
        this.state = 'progress';
        this.progress = 0;

        for (let i = 0; i < lines.length; i++) {
            if (result[lines[i].code] === undefined) {
                result[lines[i].code] = {'a': [], 'b': []};
            }

            try {
                result[lines[i].code].a = await this.dataService.getRoutedLine(lines[i].code, 'a');
            } catch(err) {
                console.log(err);
            }
            this.progress = Math.round(i / lines.length * 100);

            try {
                result[lines[i].code].b = await this.dataService.getRoutedLine(lines[i].code, 'b');
            } catch(err) {
                console.log(err);
            }
            this.progress = Math.round((i + 0.5) / lines.length * 100);
        }

        this.getShapeFile(0, lines, result);
        this.getShapeFile(1, lines, result);

        this.state = 'routeAllRoutes';
    }

    async exportOneLine(full = false) {
        this.mapService.onRouting(true);
        this.state = 'routingProgress';

        let lines = await this.dataService.getLinesInfo();
        let data: any = {};
        data[this.curLine] = {};

        let result;
        let round = 0;
        do {
            result = await this.dataService.getWholeLine(parseInt(this.curLine), this.curDir);
            round++;
        } while (result.stops === undefined && round < 3);

        if (result.stops !== undefined) {
            data[this.curLine][this.curDir] = result.route;
        }

        if (full) {
            let dir = this.curDir === 'a' ? 'b' : 'a';
            do {
                result = await this.dataService.getWholeLine(parseInt(this.curLine), dir);
                round++;
            } while (result.stops === undefined && round < 3);
    
            if (result.stops !== undefined) {
                data[this.curLine][dir] = result.route;
            }
        }

        this.getShapeFile(0, lines, data);
        this.getShapeFile(1, lines, data);

        this.mapService.onRouting(false);
        this.state = 'routeOneLineRes';
    }

    getShapeFile(type: number = 0, lines: any, result: any) {
        this.progress = 0;
        let text = 'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\r\n';
        for (let i = 0; i < lines.length; i++) {
            if (result[lines[i].code] !== undefined) {
                let idx = 0;
                if (result[lines[i].code].a !== undefined && result[lines[i].code].a.length > 0) {
                    for (let j = 0; j < result[lines[i].code].a.length; j++) {
                        if (result[lines[i].code].a[j][0] === 0 && result[lines[i].code].a[j][1] === 0) {
                            continue;
                        } else {
                            if (type === 0) {
                                text += lines[i].name;
                            } else {
                                text += 'L' + lines[i].code + 'D99';
                            }
                            text += ',' + result[lines[i].code].a[j][0] + ',' + result[lines[i].code].a[j][1] + ',' + idx + '\r\n';
                            idx++;
                        }
                    }
                }

                if (result[lines[i].code].b !== undefined && result[lines[i].code].b.length > 0) {
                    for (let j = 0; j < result[lines[i].code].b.length; j++) {
                        if (result[lines[i].code].b[j][0] === 0 && result[lines[i].code].b[j][1] === 0) {
                            continue;
                        } else {
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

    async routeStopToStop(selTransportMode: string = "") {
        if (this.stops.length === 1 && this.state === 'stopToStop0') {
            this.state = 'stopToStop1';
            return;
        } else if (this.stops.length === 1) {
            this.state = 'stopToStopWarning';
            return;
        }

        this.transportMode = selTransportMode;
        await this.getStopToStop();
    }
    
    async getStopToStop() {
        if (this.stops.length === 2) {
            if (this.transportMode !== "") {
                this.mapService.onRouting(true);
                this.state = 'routingProgress';

                let route = await this.dataService.getRoute([this.stops[0].keys[0], this.stops[1].keys[0]], this.transportMode);

                if (!route) {
                    this.defaultMenu();
                    return;
                }

                this.mapService.putRouteOnMap(route);
                this.mapService.setWhatIsOnMap('stopToStop', {transportMode: this.transportMode, stops: this.stops});
                this.mapService.onRouting(false);

                this.progressText = this.stops[0].label + '->' + this.stops[1].label;
                this.state = 'stopToStopRes';
            } else {
                this.state = 'stopToStop2';
                return;
            }
        } else {
            return;
        }
    }

    async editRoute() {
        if (this.state !== 'editRoute') {
            let loadedData = (await this.dataService.getWholeLineInfo(parseInt(this.curLine), this.curDir));
            this.curRouteStops = loadedData[0];
            this.alternativeRoutes = loadedData.splice(1, loadedData.length - 1);

            let idx = 0;
            while (idx < this.curRouteStops.length) {
                if (this.curRouteStops[idx].label === 'Medzibod') {
                    this.curRouteStops = this.curRouteStops.slice(idx, 1);
                    continue;
                }
                if (this.curRouteStops[idx].code.split('_')[3] === 'd') {
                    this.curRouteStops[idx].dis = true;
                } else {
                    this.curRouteStops[idx].dis = false;
                }

                idx++;
            }

            this.curLines.find((line: any) => {
                if (line.code === parseInt(this.curLine)) {
                    if (this.curDir === 'a') {
                        this.progressText = line.name + ': ' + line.routeA.s + ' -> ' + line.routeA.e;
                    } else {
                        this.progressText = line.name + ': ' + line.routeB.s + ' -> ' + line.routeB.e;
                    }
                }
            });
            this.state = 'editRoute';
            return;
        }
    }

    disableStop(idx: number) {
        if (this.curRouteStops[idx].code.split('_')[3] === 'd') {
            this.curRouteStops[idx].dis = false;
            this.curRouteStops[idx].code = this.curRouteStops[idx].code.slice(0, -1);
        } else {
            this.curRouteStops[idx].dis = true;
            this.curRouteStops[idx].code += 'd';

            for (let alternative of this.alternativeRoutes) {
                alternative[idx] = '';
            }
        }

        let codes = [];
        for (const stop of this.curRouteStops) {
            codes.push(stop.code);
        }

        this.dataService.updateLineRouteInfo(parseInt(this.curLine), this.curDir, JSON.stringify([codes].concat(this.alternativeRoutes)));
    }

    switchStops(idx: number, dir: string) {
        if (dir === 'up') {
            let tmp = JSON.parse(JSON.stringify(this.curRouteStops[idx - 1]));
            this.curRouteStops[idx - 1] = this.curRouteStops[idx];
            this.curRouteStops[idx] = tmp;

            for (let alternative of this.alternativeRoutes) {
                tmp = JSON.parse(JSON.stringify(alternative[idx - 1]));
                alternative[idx - 1] = alternative[idx];
                alternative[idx] = tmp;  
            }
        } else {
            let tmp = JSON.parse(JSON.stringify(this.curRouteStops[idx + 1]));
            this.curRouteStops[idx + 1] = this.curRouteStops[idx];
            this.curRouteStops[idx] = tmp;

            for (let alternative of this.alternativeRoutes) {
                tmp = JSON.parse(JSON.stringify(alternative[idx + 1]));
                alternative[idx + 1] = alternative[idx];
                alternative[idx] = tmp;
            }
        }

        let codes = [];
        for (const stop of this.curRouteStops) {
            codes.push(stop.code);
        }
        this.dataService.updateLineRouteInfo(parseInt(this.curLine), this.curDir, JSON.stringify([codes].concat(this.alternativeRoutes)));
    }

    addNewAlternativeRoute() {
        this.alternativeRoutes.push(Array(this.curRouteStops.length).fill(''));
        let codes = [];
        for (const stop of this.curRouteStops) {
            codes.push(stop.code);
        }
        this.dataService.updateLineRouteInfo(parseInt(this.curLine), this.curDir, JSON.stringify([codes].concat(this.alternativeRoutes)));
    }

    saveAlternatives(alternativeIdx: number, stopIdx: number, stopCode: string) {
        this.alternativeRoutes[alternativeIdx][stopIdx] = `${stopCode.split('_')[0]}_${stopCode.split('_')[1]}__`;
        let codes = [];
        for (const stop of this.curRouteStops) {
            codes.push(stop.code);
        }
        this.dataService.updateLineRouteInfo(parseInt(this.curLine), this.curDir, JSON.stringify([codes].concat(this.alternativeRoutes)));
    }

    removeAlternative(index: number) {
        this.alternativeRoutes.splice(index, 1);
        let codes = [];
        for (const stop of this.curRouteStops) {
            codes.push(stop.code);
        }
        this.dataService.updateLineRouteInfo(parseInt(this.curLine), this.curDir, JSON.stringify([codes].concat(this.alternativeRoutes)));
    }
}
