import installYamcsPlugins from '../src/openmct-yamcs.js';

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const config = {
    yamcsDictionaryEndpoint: `${window.location.origin}/yamcs-proxy/`,
    yamcsHistoricalEndpoint: `${window.location.origin}/yamcs-proxy/`,
    yamcsWebsocketEndpoint: `${wsProtocol}//${window.location.host}/yamcs-proxy-ws/`,
    yamcsUserEndpoint: `${window.location.origin}/yamcs-proxy/api/user/`,
    yamcsInstance: process.env.YAMCS_INSTANCE,
    yamcsProcessor: process.env.YAMCS_PROCESSOR,
    yamcsFolder: process.env.YAMCS_FOLDER,
    throttleRate: 1000,
    maxBufferSize: 1000000
};
const STATUS_STYLES = {
    NO_STATUS: {
        iconClass: "icon-question-mark",
        iconClassPoll: "icon-status-poll-question-mark"
    },
    GO: {
        iconClass: "icon-check",
        iconClassPoll: "icon-status-poll-question-mark",
        statusClass: "s-status-ok",
        statusBgColor: "#33cc33",
        statusFgColor: "#000"
    },
    MAYBE: {
        iconClass: "icon-alert-triangle",
        iconClassPoll: "icon-status-poll-question-mark",
        statusClass: "s-status-warning",
        statusBgColor: "#ffb66c",
        statusFgColor: "#000"
    },
    NO_GO: {
        iconClass: "icon-circle-slash",
        iconClassPoll: "icon-status-poll-question-mark",
        statusClass: "s-status-error",
        statusBgColor: "#9900cc",
        statusFgColor: "#fff"
    }
};
const openmct = window.openmct;

(() => {
    const POLL_INTERVAL = 100; // ms
    const MAX_POLL_TIME = 10000; // 10 seconds
    const COMPOSITION_RETRY_DELAY = 250; // ms
    const MAX_COMPOSITION_RETRIES = 20; // 5 seconds total with 250ms intervals
    const ONE_SECOND = 1000;
    const ONE_MINUTE = ONE_SECOND * 60;
    const THIRTY_MINUTES = ONE_MINUTE * 30;

    openmct.setAssetPath("/node_modules/openmct/dist");

    installDefaultPlugins();
    openmct.install(installYamcsPlugins(config));
    openmct.install(
        openmct.plugins.OperatorStatus({ statusStyles: STATUS_STYLES })
    );

    document.addEventListener("DOMContentLoaded", function () {
        openmct.start();
    });
    openmct.install(
        openmct.plugins.Conductor({
            menuOptions: [
                {
                    name: "Realtime",
                    timeSystem: "utc",
                    clock: "local",
                    clockOffsets: {
                        start: -THIRTY_MINUTES,
                        end: 0
                    }
                },
                {
                    name: "Fixed",
                    timeSystem: "utc",
                    bounds: {
                        start: Date.now() - THIRTY_MINUTES,
                        end: 0
                    }
                }
            ]
        })
    );

    function installDefaultPlugins() {
        openmct.install(openmct.plugins.LocalStorage());
        openmct.install(openmct.plugins.Espresso());
        openmct.install(openmct.plugins.MyItems());
        openmct.install(openmct.plugins.example.Generator());
        openmct.install(openmct.plugins.example.ExampleImagery());
        openmct.install(openmct.plugins.UTCTimeSystem());
        openmct.install(openmct.plugins.TelemetryMean());

        openmct.install(
            openmct.plugins.DisplayLayout({
                showAsView: ["summary-widget", "example.imagery", "yamcs.image"]
            })
        );
        openmct.install(openmct.plugins.SummaryWidget());
        openmct.install(openmct.plugins.Notebook());
        openmct.install(openmct.plugins.LADTable());
        openmct.install(
            openmct.plugins.ClearData([
                "table",
                "telemetry.plot.overlay",
                "telemetry.plot.stacked"
            ])
        );

        openmct.install(openmct.plugins.FaultManagement());
        openmct.install(openmct.plugins.BarChart());
        openmct.install(openmct.plugins.Timeline());
        openmct.install(openmct.plugins.EventTimestripPlugin());
    }
})();
