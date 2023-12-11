import { Component, Input, OnInit } from '@angular/core';
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
    acStopsFileContent: any = undefined;
    acLinesFileContent: any = undefined;
    progress = 0;
    progressText = "";
    loadState = 0;

    async defaultMenu() {
        this.warning = false;
        this.warningType = false;
        this.warningText = "";
        this.warningTypeText = "";
        this.acStopsFileContent = undefined;
        this.acLinesFileContent = undefined;
        this.state = 'menu';
    }

    readFile(event: any) {
        if (event.target.files[0] === undefined) {
            this.warningType = true;
            this.warningTypeText = "Vybraný soubor se nepodařilo načíst";
            return;
        }

        for (let i = 0; i < event.target.files.length; i++) {
            // Line order file
            if (event.target.files[i].type === "text/csv") {
                this.readFileContent(event.target.files[i], 0);
            // Stops txt file
            } else if (event.target.files[i].type === "text/plain") {
                this.readFileContent(event.target.files[i], 1);
            // Line codes file
            } else if (event.target.files[i].type === '') {
                // TO DO
            }
        }
    }

    readFileContent(file: any, type: number) {
        let fileReader = new FileReader();
        fileReader.onload = () => {
            try {
                if (fileReader.result === null) {
                    this.warningType = true;
                    this.warningTypeText = "Chyba při načítání dat, vybraný soubor není ve správném formátu";
                } else {
                    if (type === 0) {
                        this.acLinesFileContent = fileReader.result;
                    } else if (type === 1) {
                        this.acStopsFileContent = fileReader.result;
                    } else {
                        // TO DO
                    }
                }
            } catch {
                this.warningType = true;
                this.warningTypeText = "Chyba při načítání dat, vybraný soubor není ve správném formátu";
                return;
            }
            this.warningType = false;
        }

        fileReader.readAsText(file, "iso-8859-2");
    }

    async importData() {
        if (this.state !== "impData") {
            this.state = "impData";
            return;
        }

        let stats = await this.dataService.getStats();

        if (this.acStopsFileContent === undefined && this.acLinesFileContent === undefined) {
            this.state = "impNoDataWar";
            return;
        }

        if (stats['stops'] > 0) {
            this.state = "impDataWar";
            return;
        }

        this.importDataIntroDB();
    }

    async importDataIntroDB() {
        if (this.progress === 100) {
            this.progress = 0;
            this.defaultMenu();
            return;
        }

        if (this.acStopsFileContent !== undefined) {
            console.log('a');
            await this.importStopsIntroDB();
        }

        if (this.acLinesFileContent !== undefined) {
            await this.importLinesIntroDB();
        }
    }

    async importStopsIntroDB() {
        this.state = 'progress';
        this.progress = 0;
        this.progressText = "Zpracování dat";
        await this.dataService.clearData('stops');

        let content = this.acStopsFileContent.split('\r\n');
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

                name = this.isoFix(name);
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
        
        let upIndex = 10;
        for (let i = 0; i < stops.length; i+=10) {
            if (upIndex > (stops.length - 1)) {
                upIndex = stops.length;
            }
            await this.dataService.createPoints(stops.slice(i, upIndex));
            upIndex += 10;
            this.progress = Math.round(i / stops.length * 100);
        }

        this.progressText = "Zpracování dat je dokončeno"
        this.progress = 100;
    }


    async importLinesIntroDB() {
        this.state = 'progress';
        this.progress = 0;
        this.progressText = "Zpracování dat";
        await this.dataService.clearData('lines');

        let content = this.acLinesFileContent.split('\r\n');
        let lines: any = [];

        for (let i = 1; i < content.length;) {
            let line = content[i].split(";");
            let record: any = {'lc': line[0], 'type': line[1], 'routeA': [], 'routeB': []};
            let routeA: any = [];
            let routeB: any = [];

            do {
                if (line[3] !== 'konečná' || line[0] !== '' || content[i + 1].split(";")[0] !== '') {
                    if (line[4] !== '' && line[5] !== '' &&
                        line[4] !== undefined && line[5] !== undefined &&
                        line[5].split(',').length === 1) {
                        if (line[5].split(',').length > 1) {
                            line[5] = line[5].split(',')[0];
                        }
                        routeA.push(line[4] + '_' + line[5]);
                        }
                    if (line[4] !== '' && line[6] !== '' &&
                        line[4] !== undefined && line[6] !== undefined &&
                        line[6].split(',').length === 1) {
                        routeB.unshift(line[4] + '_' + line[6]);
                    }
                }

                i++;
                if (content[i] !== undefined) {
                    line = content[i].split(";");
                } else {
                    break;
                }
            } while(line[0] === '' && i < content.length)

            record.routeA = routeA;
            record.routeB = routeB;
            // Trolej
            if (record.type === 'Vlak') {
                record.type = 'rail';
                lines.push(record);
            } else if (record.type === 'Bus') {
                // TO DO
            } else if (record.type === 'Tram') {
                record.type = 'tram';
                lines.push(record);
            }
        }

        console.log(lines);
        
        let upIndex = 20;
        for (let i = 0; i < lines.length; i+=20) {
            if (upIndex > (lines.length - 1)) {
                upIndex = lines.length;
            }
            await this.dataService.saveLines(lines.slice(i, upIndex));
            upIndex += 20;
            this.progress = Math.round(i / lines.length * 100);
        }

        this.progressText = "Zpracování dat je dokončeno"
        this.progress = 100;
    }

    isoFix(input: string) {
        input = input.replaceAll('\u009a', "š");
        input = input.replaceAll('\u009e', "ž");
        input = input.replaceAll('\u009d', "ť");
        return input;
    }
}
