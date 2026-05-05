/// <reference path="../types/declarations.d.ts" />
interface autoObject {
    value: string;
    label: string;
}
import $ from 'jquery';
import 'jquery-ui/ui/widgets/autocomplete';
import 'jquery-ui/themes/base/all.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as bootstrap from "bootstrap";
import { CapacitorHttp } from '@capacitor/core';
//import { Capacitor } from '@capacitor/core';
//import { LocalNotifications } from '@capacitor/local-notifications';
//import { Share } from '@capacitor/share';
//import 'maplibre-gl/dist/maplibe-gl.css';
import {initMap} from "./map";

const importHike = async (hike: string) => {
    const site_gpx = await CapacitorHttp.post({
        url: 'https://nmhikes.com/ktesa_app/importHike.php',
        headers: { 'Content-Type': 'application/json' },
        data: { 
            hike: hike 
        }
    });
    const gpx_string = site_gpx.data;
};
const ui_sources = async () => {
    var hikeSources: autoObject[];
    const autosources = await CapacitorHttp.get({
        url: 'https://nmhikes.com/ktesa_app/appSiteHikes.php',
        responseType: 'text'
    });
    hikeSources = JSON.parse(autosources.data);
    ($('#search') as JQuery<HTMLInputElement>).autocomplete({
        appendTo: '.modal-body',
        source: hikeSources,
        minLength: 2
    });
    $('#search').on("autocompleteselect", function (event, ui) {
        event.preventDefault();
        var entry = ui.item.value;
        $('#search').val(entry);
        importHike(entry);
    });
    $('body').on('click', '#clear', function () {
        $('#search').val("").trigger("focus");
    });
}
(async function main() {
    const save_div = document.getElementById('save_type') as HTMLDivElement;
    const site_type  = new bootstrap.Modal(save_div);
    const menu_close = () => {
        $('#disp').text("Closed");
        $('#menu').animate({ left: "-=230"}, 500);
    }
    $('#menu_trigger').on('click', () => {
        if ($('#disp').text() === 'Closed') {
            $('#disp').text("Open");
            $('#menu').animate({ left: "0" }, 500)
        } else {
            menu_close();
        }
    });
    $('#save').on('click', () => {
        menu_close();
        site_type.show();
    });
    ui_sources();
    const { map } = await initMap("map");
})();
