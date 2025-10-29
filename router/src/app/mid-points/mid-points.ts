import { Component } from '@angular/core';
import { DataService } from '../data.service';
import { MapService } from '../map/map.service';

@Component({
    selector: 'mid-points',
    templateUrl: './mid-points.html',
    styleUrls: ['./mid-points.css'],
    standalone: false
})

export class MidPointsComponent {
    constructor(private dataService: DataService, private mapService: MapService) {
        this.mapService.onStopClickEvent().subscribe((stop) => {
            if (this.midPointStops.length === 0 || this.midPointStops[0].label !== stop.label.toString()) {
                this.midPointStops.push(stop);
            }

            if (this.state === 'addMidPoint0' || this.state === 'addMidPoint1' || this.state === 'addMidPointWarning') {
                this.addMidPoint();
            }
        })
    }
    state = 'menu';
    midPointStops: any = [];

    defaultMenu() {
        this.state = 'menu';
        this.midPointStops = [];
        this.mapService.visibilityUpdate();
    }

    addMidPointStart() {
        this.state = 'addMidPoint0';
        this.midPointStops = [];
    }

    async addMidPoint() {
        if (this.midPointStops.length === 1 && this.state === 'addMidPoint0') {
            this.state = 'addMidPoint1';
            return;
        } else if (this.midPointStops.length === 1) {
            this.state = 'addMidPointWarning';
            return;
        }

        if (this.midPointStops.length === 2) {
            let midPoint = [[(this.midPointStops[0].geom[0] + this.midPointStops[1].geom[0]) / 2, (this.midPointStops[0].geom[1] + this.midPointStops[1].geom[1]) / 2]];
            await this.dataService.addMidpoint(this.midPointStops[0].keys, this.midPointStops[1].keys, midPoint);
        }
        
        this.defaultMenu();
    }
}
