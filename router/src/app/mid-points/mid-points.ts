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
        this.mapService.onStopClickEvent().subscribe((stop) => {
            if (this.stops.length === 0 || this.stops[0].label !== stop.label.toString()) {
                this.stops.push(stop);
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
        this.mapService.visibilityUpdate();
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
            await this.dataService.addMidpoint(this.stops[0].keys, this.stops[1].keys, midPoint);
        }
        
        this.defaultMenu();
    }
}