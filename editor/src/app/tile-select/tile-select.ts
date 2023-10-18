import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MapService } from '../map/map.service';
import { DataService } from '../data.service';

@Component({
    selector: 'tile-select',
    templateUrl: './tile-select.html',
    styleUrls: ['./tile-select.css']
})

export class TileSelectComponent implements OnInit {
    constructor(private mapService: MapService, private dataService: DataService) {}
    @ViewChild('option', { static: true}) tiles!: ElementRef;
    imgStyles = ["", "", ""]

    ngOnInit() {
        this.imgStyles[this.dataService.getTitleIndex()] = "img_selected";
    }

    changeTiles(id: number): void {
        for (let i = 0; i < this.imgStyles.length; i++) {
            if (i != id) {
                this.imgStyles[i] = "";
            }
        }

        this.imgStyles[id] = "img_selected";
        this.mapService.changeBaseMap(id);
    }
}
