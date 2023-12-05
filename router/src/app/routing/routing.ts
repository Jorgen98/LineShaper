import { Component, Input, OnInit } from '@angular/core';
import { DataService } from '../data.service';
import { MapService } from '../map/map.service';

@Component({
    selector: 'routing',
    templateUrl: './routing.html',
    styleUrls: ['./routing.css']
})

export class RoutingComponent implements OnInit {
    constructor(private dataService: DataService, private mapService: MapService) {}
    state = 'menu';
    curLine = '';
    curLines: any = [];
    curDir = '';
    curLineEnds: any = [];

    async ngOnInit() {
        this.curLines = await this.dataService.getLinesInfo();

        if (this.curLines.length > 0) {
            this.curLine = this.curLines[0].code;

            this.setLineEnds();
        }
    }

    async defaultMenu() {
        this.state = 'menu';
    }

    async routeOneLine() {
        if (this.state !== 'routeOneLine') {
            this.state = 'routeOneLine';
            return;
        }
        
        let route = await this.dataService.getWholeLine(parseInt(this.curLine), this.curDir);

        if (!route) {
            this.defaultMenu();
            return;
        }

        this.mapService.putRouteOnMap(route);
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
}
