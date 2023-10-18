import { Component, OnInit, ViewChild } from '@angular/core';
import { MapService } from './map/map.service';
import { AppDirective } from './app.directive';
import { TileSelectComponent } from './tile-select/tile-select';
import { DataService } from './data.service';
import { FilesManipulationComponent } from './files-manipulation/files-manipulation';
import { LayerSelectComponent } from './layer-select/layer-select';

@Component({
    selector: 'app-root',
    templateUrl: './app.html',
    styleUrls: ['./app.css']
})

export class AppComponent implements OnInit {
    constructor(private mapService: MapService, private dataService: DataService) {}
    @ViewChild(AppDirective, { static: true}) mapTiles!: AppDirective;
    menuIndexBtn = ["", "", "", "", ""];

    ngOnInit(): void {
        this.openMenuItem(2);
        this.closeMenuItem();
        this.menuIndexBtn[2] = "";
    }

    zoomIn(): void {
        this.mapService.zoomIn();
    }

    zoomOut(): void {
        this.mapService.zoomOut();
    }

    openMenuItem(id: number): void {
        this.closeMenuItem();
        if (this.menuIndexBtn[id] != "") {
            this.menuIndexBtn[id] = "";
            return;
        }

        for (let i = 0; i < this.menuIndexBtn.length; i++) {
            if (this.menuIndexBtn[i] != "") {
                this.menuIndexBtn[i] = "";
            }
        }
        
        this.menuIndexBtn[id] = "selBtn";
        const viewContainerRef = this.mapTiles.viewContainerRef;
        switch (id) {
            case 0: viewContainerRef.createComponent(TileSelectComponent); break;
            case 1: viewContainerRef.createComponent(LayerSelectComponent); break;
            case 2: viewContainerRef.createComponent(FilesManipulationComponent); break;
            default: break;
        }
    }

    closeMenuItem(): void {
        const viewContainerRef = this.mapTiles.viewContainerRef;
        viewContainerRef.clear();
    }
}
