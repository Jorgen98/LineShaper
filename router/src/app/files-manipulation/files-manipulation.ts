import { Component, OnInit } from '@angular/core';
import { DataService } from '../data.service';
import { MapService } from '../map/map.service';
import { formatDate } from '@angular/common';

@Component({
    selector: 'files-manipulation',
    templateUrl: './files-manipulation.html',
    styleUrls: ['./files-manipulation.css']
})

export class FilesManipulationComponent {
    constructor(private dataService: DataService, private mapService: MapService) {}
    state = 'menu';
    warning = false;
    warningText = "";
    warningType = false;
    warningTypeText = "";
    acFileContent: any = undefined;
    progress = 0;
    progressText = "";

    async defaultMenu() {
        this.warning = false;
        this.warningType = false;
        this.warningText = "";
        this.warningTypeText = "";
        this.acFileContent = undefined;
        this.state = 'menu';
    }

    readFileContent(event: any) {
        if (event.target.files[0] === undefined) {
            this.warningType = true;
            this.warningTypeText = "Vybraný soubor se nepodařilo načíst";
            return;
        }

        let fileReader = new FileReader();
        fileReader.onload = (input) => {
            try {
                if (fileReader.result === null) {
                    this.warningType = true;
                    this.warningTypeText = "Chyba při načítání dat, vybraný soubor není ve správném formátu";
                } else {
                    this.acFileContent = JSON.parse(fileReader.result.toString());
                }
            } catch {
                this.warningType = true;
                this.warningTypeText = "Chyba při načítání dat, vybraný soubor není ve správném formátu";
                return;
            }
            this.warningType = false;
        }
        fileReader.readAsText(event.target.files[0]);
    }

    async importMaps() {
        this.importMapIntroDB();
    }

    async importMapIntroDB() {
        if (this.progress === 100) {
            this.progress = 0;
            this.defaultMenu();
            return;
        }
        this.state = 'progress';
        this.progress = 0;
        this.progressText = "Zpracování dat";

        this.progressText = "Zpracování dat je dokončeno"
        this.progress = 100;
    }
}
