import mysql from 'mysql2/promise';
export const pool=mysql.createPool({host:process.env.DB_HOST||'127.0.0.1',port:+(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'uniform_kings',waitForConnections:true,connectionLimit:8,decimalNumbers:true,charset:'utf8mb4'});
export const rows=async(sql,params=[])=>{const [r]=await pool.execute(sql,params);return r};
export const one=async(sql,params=[])=>(await rows(sql,params))[0]||null;
