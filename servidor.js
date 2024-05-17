const express = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const mysql = require('mysql2');
const util = require('util');

const app = express();

// Configuración de conexión a la base de datos
const con = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'proyecto'
});

con.connect((error) => {
  if (error) {
    console.error('Error connecting to MySQL database:', error);
  } else {
    console.log('Connected to MySQL database!');
  }
});

// Configuración de multer para manejar la subida de archivos
const upload = multer({ dest: 'uploads/' });


// Ruta: / (principal - root)
app.use(express.static("public"));


// Ruta: /api/usuarios
app.get('/api/usuarios', (req, res) => {
  // Consulta la base de datos y devuelve la lista de usuarios en formato JSON
  const consulta = 'SELECT * FROM persona';

  con.query(consulta, (error, results, fields) => {
    if (error) {
      res.status(500).json({ message: 'Error al consultar los usuarios' });
      return;
    }

    res.status(200).json(results);

  });
});

// Ruta: /api/usuarios/export
app.get('/api/usuarios/export', (req, res) => {
  // Exporta los datos de usuarios a un archivo CSV llamado “usuarios.csv”

  const consulta = 'SELECT * FROM persona';

  con.query(consulta, (error, results, fields) => {

    if (error) {
      res.status(500).json({ error: 'Error al exportar los usuarios' });
      return;
    }

    if (results.length < 1) {
      return res.status(200).json({
        message: 'No se encontraron registros por exportar' 
      })
    }

    const csvData = [];

    results.forEach((usuario) => {
      csvData.push(Object.values(usuario).join(','));
    });

    const csvHeaders = Object.keys(results[0]).join(',');

    const csvContent = `${csvHeaders}\n${csvData.join('\n')}`;

    fs.writeFile('usuarios.csv', csvContent, (err) => {
      if (err) {
        res.status(500).json({ error: 'Error al escribir el archivo CSV' });
        return;
      }
      res.download('usuarios.csv');
    });
  });
});


// Ruta: /api/usuarios/import
app.post('/api/usuarios/import', upload.single('usuariosCSV'), (req, res) => {

  // Lee el archivo CSV y guarda los datos en la base de datos MySQL

  // Verificar si se envió un archivo
  if (!req.file) {
    return res.status(400).json({ message: 'No se envió ningún archivo' });
  }

  // Verificar si el archivo no es de formato CSV
  if (req.file.mimetype !== 'text/csv') {
    return res.status(400).json({ message: 'El archivo debe ser de formato CSV' });
  }

  const usuarios = [];

  fs.createReadStream(req.file.path)
    .pipe(csvParser())
    .on('data', (row) => {
      usuarios.push(row);
    })
    .on('end', async () => {
      // Procesar los datos de los usuarios y guardarlos en la base de datos
      // Se deben manejar errores como archivos no encontrados, formatos incorrectos, etc.
      // Además, se debe implementar una validación de datos para asegurar que los campos requeridos estén presentes y tengan el formato adecuado

      const consulta_datos = 'SELECT * FROM persona';

      const query_consulta = util.promisify(con.query).bind(con);
      
      const resultado_datos = await query_consulta(consulta_datos);

      let registros_duplicados = [];

      for (let i = 0; i < usuarios.length; i++) {
          for (let j = 0; j < resultado_datos.length; j++) {          
            if (!usuarios[i].correo_persona) {
              registros_duplicados.push({ index: (i + 1), correo_persona: usuarios[i].correo_persona, error: 'El correo no debe estar vacío' });
              break;
            }
            
            if (validarFormatoCorreo(usuarios[i].correo_persona)) {
              if (usuarios[i].correo_persona == resultado_datos[j].correo_persona) {
                registros_duplicados.push({ index: (i + 1), correo_persona: usuarios[i].correo_persona, error: 'Registro duplicado' });
                break;
              }
            } else {
              registros_duplicados.push({ index: (i + 1), correo_persona: usuarios[i].correo_persona, error: 'El correo no cumple con un formato válido' });
              break;
            }        
          }
      }

      if (registros_duplicados.length > 0) {
        return res.status(400).json({
          registros_duplicados
        })
      }

      usuarios.forEach((usuario) => {
        const { nombre_persona, apellido_persona, dni_persona, correo_persona, edad_persona, telefono_persona} = usuario;
        // Aquí puedes realizar la validación de los datos antes de insertarlos en la base de datos
        // Por ejemplo, verificar que todos los campos requeridos estén presentes y tengan el formato adecuado

        const consulta = `INSERT INTO persona (nombre_persona, apellido_persona, dni_persona, correo_persona, edad_persona, fecha_creacion, telefono_persona) 
                          VALUES (?, ?, ?, ?, ?, NOW(), ?)`;

        const valores = [nombre_persona, apellido_persona, dni_persona, correo_persona, edad_persona, telefono_persona];

        con.query(consulta, valores, (error, results, fields) => {
          if (error) {
            res.status(400).json({ ok: false, message: 'Hubo un error al insertar los datos...' });
            return;
          }
        });
      });

      res.status(200).json({ message: 'Datos de usuarios importados exitosamente' });
    });
});

const puerto = 3000;
app.listen(puerto, () => {
  console.log('Servidor escuchando en el puerto:', puerto);
});


function validarFormatoCorreo(correo) {
  // Expresión regular para validar el formato del correo electrónico
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(correo);
}
