import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DataService } from '../data.service';

@Component({
    selector: 'layer-select',
    templateUrl: './layer-select.html',
    styleUrls: ['./layer-select.css'],
    standalone: false
})

export class LayerSelectComponent implements OnInit {
    constructor(private dataService: DataService) {}
    @ViewChild('option', { static: true}) tiles!: ElementRef;
    layerStyles = ["layerBtn", "layerBtn", "layerBtn"]

    ngOnInit() {
        if (this.dataService.getCurLayer() === 'rail') {
            this.layerStyles[0] = "layerBtnSel";
        } else if (this.dataService.getCurLayer() === 'road') {
            this.layerStyles[1] = "layerBtnSel";
        } else {
            this.layerStyles[2] = "layerBtnSel";
        }
    }

    changeLayer(id: number): void {
        for (let i = 0; i < this.layerStyles.length; i++) {
            this.layerStyles[i] = "layerBtn";
        }

        this.layerStyles[id] = "layerBtnSel";
        if (id === 0) {
            this.dataService.openLayer('rail');
        } else if (id === 1) {
            this.dataService.openLayer('road');
        } else {
            this.dataService.openLayer('tram');
        }
    }
}
