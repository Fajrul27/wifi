const { RouterOSClient } = require('node-routeros');
const { decrypt } = require('./crypto');

const connectMikrotik = async (routerData) => {
    const connection = new RouterOSClient({
        host: routerData.host,
        user: routerData.username,
        password: decrypt(routerData.password), // Dekripsi sebelum dipakai
        port: routerData.port
    });
    
    await connection.connect();
    return connection;
};

module.exports = { connectMikrotik };