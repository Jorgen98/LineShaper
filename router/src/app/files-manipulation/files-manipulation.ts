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
                    this.acFileContent = fileReader.result;
                }
            } catch {
                this.warningType = true;
                this.warningTypeText = "Chyba při načítání dat, vybraný soubor není ve správném formátu";
                return;
            }
            this.warningType = false;
        }
        fileReader.readAsText(event.target.files[0], "iso-8859-2");
    }

    async importData() {
        if (this.state !== "impData") {
            this.state = "impData";
            return;
        }

        let stats = await this.dataService.getStats();

        if (stats['stops'] > 0) {
            this.state = "impDataWar";
            return;
        }

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
        await this.dataService.clearData();

        let content = this.acFileContent.split('\r\n');
        let stops: any = [];

        for (let i = 0; i < content.length;) {
            let line = content[i].split(" ");
            let key = line[0];
            if (line[2] !== undefined) {
                let j = 0;
                let name = line[2];
                while(line[2 + j][line[2 + j].length - 1] === ',' || line[2 + j][line[2 + j].length - 1] !== "'") {
                    j++;
                    name += ' ' + line[2 + j];
                }

                name = name.replaceAll('\u009a', "š");
                name = name.replaceAll('\u009e', "ž");
                name = name.replaceAll('\u009d', "ť");
                name = name.replaceAll('&', "a");
                stops.push({'id': parseInt(line[0]), 'n': name.replaceAll("'", ""), 'p': {}});

                let positions: any = [];
                i++;
                line = content[i].split(" ");
                while (line[0] === "" && line[1] === "") {
                    positions.push({'n': line[2].replaceAll("S", ""), 'p': [parseInt(line[4])/100000/60, parseInt(line[3])/100000/60]});
                    i++;
                    line = content[i].split(" ");
                }
                
                stops[stops.length - 1].p = positions;
            } else {
                i++;
            }
        }
        
        let upIndex = 40;
        for (let i = 0; i < stops.length; i+=40) {
            if (upIndex > (stops.length - 1)) {
                upIndex = stops.length;
            }
            await this.dataService.createPoints(stops.slice(i, upIndex));
            upIndex += 40;
            this.progress = Math.round(i / stops.length * 100);
        }

        this.progressText = "Zpracování dat je dokončeno"
        this.progress = 100;
    }
}
