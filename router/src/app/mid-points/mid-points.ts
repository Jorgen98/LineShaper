import { Component } from '@angular/core';
import { DataService } from '../data.service';
import { MapService } from '../map/map.service';

@Component({
    selector: 'mid-points',
    templateUrl: './mid-points.html',
    styleUrls: ['./mid-points.css']
})

export class MidPointsComponent {
    constructor(private dataService: DataService, private mapService: MapService) {
        this.mapService.onStopClickEvent().subscribe((code) => {
            if (this.stops.length === 0 || this.stops[0] !== code) {
                this.stops.push(code);
            }

            if (this.state === 'addMidPoint0' || this.state === 'addMidPoint1' || this.state === 'addMidPointWarning') {
                this.addMidPoint();
            }
        })
    }
    state = 'menu';
    stops: any = [];

    defaultMenu() {
        this.state = 'menu';
        this.stops = [];
    }

    addMidPointStart() {
        this.state = 'addMidPoint0';
        this.stops = [];
    }

    async addMidPoint() {
        if (this.stops.length === 1 && this.state === 'addMidPoint0') {
            this.state = 'addMidPoint1';
            return;
        } else if (this.stops.length === 1) {
            this.state = 'addMidPointWarning';
            return;
        }

        if (this.stops.length === 2) {
            let midPoint = [[(this.stops[0].geom[0] + this.stops[1].geom[0]) / 2, (this.stops[0].geom[1] + this.stops[1].geom[1]) / 2]];
            await this.dataService.addMidpoint(this.stops[0].code + '_' + this.stops[0].subcode, this.stops[1].code + '_' + this.stops[1].subcode, midPoint);
        }
        
        this.defaultMenu();
    }
}