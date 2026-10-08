// ============================================================
// 📦 HTTP CUSTOM (.HC) CONVERTER
// ============================================================

const fs = require("fs");
const path = require("path");

const HC_TEMP_DIR = path.join(
    __dirname,
    "..",
    "temp",
    "hc"
);


// ============================================================
// 📁 ENSURE TEMP DIRECTORY
// ============================================================

function ensureHcDir() {

    if (!fs.existsSync(HC_TEMP_DIR)) {

        fs.mkdirSync(HC_TEMP_DIR, {
            recursive: true
        });

    }

}


// ============================================================
// 🧹 SAFE FILENAME
// ============================================================

function safeFilename(name) {

    return String(
        name || "vpn-account"
    )
        .replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        )
        .substring(
            0,
            80
        );

}


// ============================================================
// 🔓 DECODE VMESS LINK
// ============================================================

function decodeVmess(link) {

    if (
        !link ||
        typeof link !== "string" ||
        !link.startsWith("vmess://")
    ) {
        return null;
    }

    try {

        let encoded =
            link.substring(
                "vmess://".length
            );

        // -----------------------------------------------
        // Base64 padding
        // -----------------------------------------------

        encoded +=
            "=".repeat(
                (4 - encoded.length % 4) % 4
            );

        const decoded =
            Buffer.from(
                encoded,
                "base64"
            ).toString("utf8");

        const obj =
            JSON.parse(decoded);

        return obj;

    } catch (err) {

        console.log(
            "⚠️ VMESS DECODE ERROR:",
            err.message
        );

        return null;

    }

}


// ============================================================
// 🔎 GET VMESS DATA
// ============================================================

function extractVmessData(config) {

    const links = [

        config.vmess_tls_link,
        config.tls,

        config.vmess_nontls_link,
        config.http,

        config.vmess_grpc_link,
        config.grpc

    ].filter(Boolean);


    for (const link of links) {

        const vmess =
            decodeVmess(link);

        if (!vmess) {
            continue;
        }


        return {

            uuid:
                vmess.id ||
                "",

            domain:
                vmess.add ||
                vmess.host ||
                "",

            host:
                vmess.host ||
                vmess.add ||
                "",

            port:
                vmess.port ||
                "",

            path:
                vmess.path ||
                "",

            network:
                vmess.net ||
                "",

            tls:
                vmess.tls ||
                "",

            type:
                vmess.type ||
                "none",

            aid:
                vmess.aid ||
                "0",

            raw:
                vmess

        };

    }


    return {

        uuid: "",
        domain: "",
        host: "",
        port: "",
        path: "",
        network: "",
        tls: "",
        type: "none",
        aid: "0",
        raw: null

    };

}


// ============================================================
// 🔎 NORMALIZE CONFIG
// ============================================================

function normalizeConfig(config = {}) {

    // ========================================================
    // TYPE
    // ========================================================

    const type = String(

        config.account_type ||
        config.accountType ||
        config.type ||
        ""

    ).toLowerCase();


    // ========================================================
    // BASIC
    // ========================================================

    const username =
        config.username ||
        config.user ||
        "";


    const password =
        config.password ||
        "";


    // ========================================================
    // VMESS LINKS
    // ========================================================

    const vmess_tls_link =
        config.vmess_tls_link ||
        config.tls ||
        "";


    const vmess_nontls_link =
        config.vmess_nontls_link ||
        config.http ||
        "";


    const vmess_grpc_link =
        config.vmess_grpc_link ||
        config.grpc ||
        "";


    // ========================================================
    // EXTRACT VMESS
    // ========================================================

    const vmess =
        extractVmessData({

            ...config,

            vmess_tls_link,
            vmess_nontls_link,
            vmess_grpc_link

        });


    // ========================================================
    // UUID
    // ========================================================

    const uuid =
        config.uuid ||
        vmess.uuid ||
        "";


    // ========================================================
    // DOMAIN
    // ========================================================

    const domain =
        config.domain ||
        config.host ||
        vmess.domain ||
        "";


    // ========================================================
    // RETURN
    // ========================================================

    return {

        type,

        username,

        password,

        uuid,

        domain,

        cloudfront:
            config.cloudfront ||
            "",

        ns_domain:
            config.ns_domain ||
            "",

        payload:
            config.payload ||
            "",

        sni:
            config.sni ||
            "",

        quota:
            config.quota ||
            "",

        ip_limit:
            config.ip_limit ||
            "",

        expired:
            config.expired ||
            config.expired_at ||
            "",


        // ----------------------------------------------------
        // VMESS
        // ----------------------------------------------------

        vmess_tls_link,

        vmess_nontls_link,

        vmess_grpc_link,


        vmess,


        // ----------------------------------------------------
        // VLESS
        // ----------------------------------------------------

        vless_tls_link:
            config.vless_tls_link ||
            "",

        vless_nontls_link:
            config.vless_nontls_link ||
            "",

        vless_grpc_link:
            config.vless_grpc_link ||
            "",


        // ----------------------------------------------------
        // TROJAN
        // ----------------------------------------------------

        trojan_tls_link:
            config.trojan_tls_link ||
            "",

        trojan_grpc_link:
            config.trojan_grpc_link ||
            ""

    };

}


// ============================================================
// 🧪 VALIDATE CONFIG
// ============================================================

function validateConfig(config) {

    if (!config) {

        throw new Error(
            "Config akun tidak ditemukan."
        );

    }


    if (!config.type) {

        throw new Error(
            "Tipe akun tidak ditemukan."
        );

    }


    // --------------------------------------------------------
    // SSH
    // --------------------------------------------------------

    if (
        config.type === "ssh" &&
        !config.domain
    ) {

        throw new Error(
            "Domain SSH tidak ditemukan."
        );

    }


    // --------------------------------------------------------
    // VMESS
    // --------------------------------------------------------

    if (
        config.type === "vmess" &&
        !config.domain
    ) {

        throw new Error(
            "Domain VMess tidak ditemukan."
        );

    }


    // --------------------------------------------------------
    // VLESS
    // --------------------------------------------------------

    if (
        config.type === "vless" &&
        !config.domain
    ) {

        throw new Error(
            "Domain VLess tidak ditemukan."
        );

    }


    // --------------------------------------------------------
    // TROJAN
    // --------------------------------------------------------

    if (
        config.type === "trojan" &&
        !config.domain
    ) {

        throw new Error(
            "Domain Trojan tidak ditemukan."
        );

    }


    return true;

}


// ============================================================
// 🧱 BUILD HC CONFIG
// ============================================================

function buildHcConfig(rawConfig) {

    const config =
        normalizeConfig(
            rawConfig
        );


    validateConfig(
        config
    );


    return {

        type:
            config.type,

        username:
            config.username,

        password:
            config.password,

        uuid:
            config.uuid,

        host:
            config.domain,

        cloudfront:
            config.cloudfront,

        nameserver:
            config.ns_domain,

        payload:
            config.payload,

        sni:
            config.sni,

        quota:
            config.quota,

        ip_limit:
            config.ip_limit,

        expired:
            config.expired,


        // ----------------------------------------------------
        // VMESS
        // ----------------------------------------------------

        vmess: {

            tls:
                config.vmess_tls_link,

            http:
                config.vmess_nontls_link,

            grpc:
                config.vmess_grpc_link,

            uuid:
                config.uuid,

            host:
                config.domain,

            path:
                config.vmess.path,

            network:
                config.vmess.network,

            tls_enabled:
                config.vmess.tls,

            port:
                config.vmess.port

        },


        // ----------------------------------------------------
        // VLESS
        // ----------------------------------------------------

        vless: {

            tls:
                config.vless_tls_link,

            http:
                config.vless_nontls_link,

            grpc:
                config.vless_grpc_link

        },


        // ----------------------------------------------------
        // TROJAN
        // ----------------------------------------------------

        trojan: {

            tls:
                config.trojan_tls_link,

            grpc:
                config.trojan_grpc_link

        }

    };

}


// ============================================================
// 📦 CREATE HC FILE
// ============================================================

async function createHcFile(rawConfig) {

    ensureHcDir();


    // --------------------------------------------------------
    // NORMALIZE
    // --------------------------------------------------------

    const config =
        buildHcConfig(
            rawConfig
        );


    // --------------------------------------------------------
    // FILENAME
    // --------------------------------------------------------

    const username =
        safeFilename(
            config.username ||
            "vpn-account"
        );


    const filename =
        `${username}.hc`;


    const outputPath =
        path.join(
            HC_TEMP_DIR,
            filename
        );


    // ========================================================
    // DEBUG
    // ========================================================

    console.log(
        "📦 NORMALIZED HC CONFIG:",
        JSON.stringify(
            config,
            null,
            2
        )
    );


    // ========================================================
    // ⚠️ ENCODER
    // ========================================================
    //
    // Bagian ini sengaja BELUM membuat binary palsu.
    //
    // File .hc HTTP Custom memiliki struktur/enkripsi
    // tertentu. Kita harus memasukkan encoder yang cocok
    // dengan format template .hc kamu.
    //
    // ========================================================

    return {

        success: false,

        filename,

        outputPath,

        config,

        message:
            "HC encoder belum dipasang."

    };

}


// ============================================================
// 🧹 DELETE HC FILE
// ============================================================

function deleteHcFile(filePath) {

    try {

        if (
            filePath &&
            fs.existsSync(
                filePath
            )
        ) {

            fs.unlinkSync(
                filePath
            );

        }

    } catch (err) {

        console.error(
            "HC CLEANUP ERROR:",
            err.message
        );

    }

}


// ============================================================
// 📤 EXPORT
// ============================================================

module.exports = {

    createHcFile,

    buildHcConfig,

    normalizeConfig,

    validateConfig,

    deleteHcFile

};