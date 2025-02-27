const fs = require('fs');
const axios = require('axios');
const config = require('./config.json');

const TRACK_URL = `https://tracking.dpd.de/rest/plc/en_US/${config.track_id}`;
const STATUS_FILE = './status.json';

async function fetchTrackingInfo() {
    try {
        const response = await axios.get(TRACK_URL);
        return response.data.parcellifecycleResponse.parcelLifeCycleData;
    } catch (error) {
        console.error('Pas réussi a tracker le colis, vérifiez si le track code est correct. \n Erreur:', error);
        return null;
    }
}

function getCurrentStatus(data) {
    return data.statusInfo.find(status => status.isCurrentStatus);
}

function loadLastStatus() {
    if (fs.existsSync(STATUS_FILE)) {
        return JSON.parse(fs.readFileSync(STATUS_FILE));
    }
    return null;
}

function saveStatus(status) {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 4));
}

async function checkForStatusUpdate() {
    const trackingData = await fetchTrackingInfo();
    if (!trackingData) return;

    const currentStatus = getCurrentStatus(trackingData);
    const lastStatus = loadLastStatus();

    if (!lastStatus || lastStatus.status !== currentStatus.status) {
        console.log('Mise à jour du colis détectée:', currentStatus.label);
        sendWebhookNotification(currentStatus, trackingData);
        saveStatus(currentStatus);
    }
}

async function sendWebhookNotification(status, trackingData) {
    const trackingLink = `https://tracking.dpd.de/status/en_US/parcel/${config.track_id}`;

    const embed = {
        title: `📦 Mise à jour du colis (${trackingData.shipmentInfo.parcelLabelNumber})`,
        thumbnail: {
            url: "https://play-lh.googleusercontent.com/60IgxaBiFGQVSqq7WHSRqr2hIl2OQNaS-vhmcNtLbA9QmG-OiIjfFQpwzWQ45j7wlsM"
        },
        url: trackingLink,
        fields: [
            { name: "🛠 Statut", value: `**${status.label}**`, inline: true },
            { name: "📍 Localisation", value: status.location || "Non spécifiée", inline: true },
            { name: "📅 Date", value: status.date, inline: true },
            { name: "📦 Produit", value: trackingData.shipmentInfo.productName, inline: true },
            { name: "📦 Numéro de tri", value: trackingData.shipmentInfo.sortingCode, inline: true },
            { name: "🌍 Pays de destination", value: trackingData.shipmentInfo.receiverCountryIsoCode, inline: true }
        ],
        color: 0x0099ff,
        footer: { text: "DPD Notificator by Protechnopolis" }
    };

    await axios.post(config.webhook, {
        content: config.text,
        embeds: [embed]
    });
    console.log('Notification envoyée au webhook.');
}

setInterval(checkForStatusUpdate, 5 * 60 * 1000);
console.log("Suivi du colis activé...");
