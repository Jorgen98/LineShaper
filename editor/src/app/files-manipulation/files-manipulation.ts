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
    layers = [{'name': 'Železniční síť', 'id': 'rail'}, {'name': 'Silniční síť', 'id': 'road'}, {'name': 'Tramvajová síť', 'id': 'tram'}];
    curLayer = 'rail';

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

    async exportMaps() {
        if (this.state !== "exMap") {
            this.state = "exMap";
            return;
        }

        this.exportMapFromDB();
    }

    async importMaps() {
        if (this.state !== "impMap") {
            this.state = "impMap";
            return;
        }

        if (this.acFileContent === undefined) {
            this.warningType = true;
            this.warningTypeText = "Nenahráli jste žádný soubor";
            return;
        }
        this.warningType = false;

        if (this.acFileContent === undefined || this.acFileContent.type === undefined ||
            this.acFileContent.hubs === undefined || this.acFileContent.valid === undefined) {
            this.warning = true;
            this.warningText = "Načtený soubor není ve správném formátu";
            return;
        }

        if (this.acFileContent.type !== 'rail' && this.acFileContent.type != 'road' && this.acFileContent.type != 'tram') {
            this.warning = true;
            this.warningText = "Načtený soubor není ve správném formátu";
        };

        let stats = await this.dataService.getStats();

        if (stats[this.acFileContent.type] > 0) {
            this.state = "impMapWar";
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

        let layer = JSON.parse(JSON.stringify(this.dataService.getCurLayer()));
        this.dataService.setCurLayer(this.acFileContent.type);
        this.dataService.deleteAcLayer();

        for (let i = 0; i < this.acFileContent.hubs.length; i++) {
            let neig = this.acFileContent.hubs[i].n;
            for (let j = 0; j < neig.length; j++) {
                neig[j] += 1;
            }
        }

        let upIndex = 50;
        for (let i = 0; i < this.acFileContent.hubs.length; i+=50) {
            if (upIndex > (this.acFileContent.hubs.length - 1)) {
                upIndex = this.acFileContent.hubs.length;
            }
            await this.dataService.createPoints(this.acFileContent.hubs.slice(i, upIndex));
            upIndex += 50;
            this.progress = Math.round(i / this.acFileContent.hubs.length * 100);
        }

        this.dataService.openLayer(layer);
        this.progressText = "Zpracování dat je dokončeno"
        this.progress = 100;
    }

    async exportMapFromDB() {
        if (this.progress === 100) {
            this.progress = 0;
            this.defaultMenu();
            return;
        }
        this.state = 'progress';
        this.progress = 0;
        this.progressText = "Export dat";

        let layer = JSON.parse(JSON.stringify(this.dataService.getCurLayer()));
        this.dataService.setCurLayer(this.curLayer);

        let data = [];
        let gid = 0;
        let recNum = (await this.dataService.getStats())[this.curLayer];
        let procRec = 0;
        let result: any = [];
        let indexes: any = {};
        while ((data = await this.dataService.getPointsByGid(gid)).length > 0) {
            gid = data[data.length - 1].gid;
            for (let i = 0; i < data.length; i++, procRec++) {
                result.push(data[i]);
                indexes[data[i].gid] = procRec;
            }
            this.progress = Math.round(procRec / recNum * 100);
            data = [];
        }

        for (let i = 0; i < result.length; i++) {
            result[i].n = [];
            for (let j = 0; j < result[i].conns.length; j++) {
                if (indexes[result[i].conns[j]] !== undefined) {
                    result[i].n.push(indexes[result[i].conns[j]]);
                }
            }

            delete result[i].gid;
            delete result[i].conns;
            result[i].p = JSON.parse(JSON.stringify(result[i].geom));
            delete result[i].geom;
        }

        let filename = this.curLayer + "_" + formatDate(new Date(), 'yyyy-MM-dd', 'en') + ".geojson";
        let blob = new Blob([JSON.stringify({"type": this.curLayer,
            "valid": formatDate(new Date(), 'yyyy-MM-dd', 'en'), "hubs": result})], { type: 'text/json' });

        let a = document.createElement("a");
        document.body.appendChild(a);
        a.setAttribute('download', filename);
        a.style.display = 'none';
        a.href = window.URL.createObjectURL(blob);
        a.download = filename;
        a.click();

        this.dataService.setCurLayer(layer);
        this.progressText = "Exportování dat je dokončeno"
        this.progress = 100;
    }
}
