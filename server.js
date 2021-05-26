import express, { request } from 'express';
import bcrypt from 'bcrypt';
import knex from 'knex';

const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
  }
});

const app = express();

app.use(express.urlencoded({extended: false}));
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  });

app.post('/signin', (req,res) => {
    console.log(req.body.password)
    db.select('*').from('login')
    .where('email', '=', req.body.email)
    .then( data => {
        console.log(data[0].hash, "HASH")
        const isValid = bcrypt.compareSync(req.body.password, data[0].hash);
        if(isValid) {
            console.log("IS VALID RETURNED TRUE")
            return db.select('*').from('users')
            .where('email','=', req.body.email)
            .then(user => res.json(user[0]))
            .catch(err => res.status(404).json("Unable to get user"))
        }
        else {
            res.json("error")
        }
    })
    .catch(error => res.json("error"))
})

app.post('/register', (req,res) => {
    const saltRounds = 10;
    const hash = bcrypt.hashSync(req.body.password, saltRounds);
    console.log("The name that has been given for registration: ", req.body.name)
    console.log("The email that has been given for registration: ", req.body.email)
    console.log("The password that has been given for registration: ", req.body.password)
    db.transaction (trx => {
        trx.insert({
            hash: hash,
            email: req.body.email
        }).into('login')
        .returning('email')
        .then((loginEmail) => {
            console.log("Inside the user table adding block")
            console.log(loginEmail[0]);
            db('users')
            .returning('*')
            .insert({
                email: loginEmail[0],
                name: req.body.name,
                joined: new Date()
            })
            .then(users => res.json("success"))
            .catch(error => res.json("Unable to Join"));
        })
        .then(trx.commit)
        .catch(trx.rollback)
    })
})

app.post('/addCategory', (req,res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    console.log(req)
            db('categories')
            .returning('*')
            .insert({
                companyid: req.body.id,
                name: req.body.name,
                image: req.body.image,
            })
            .then(data => res.json(data))
            .catch(error => res.json("Unable to Join"));
})


app.post('/addProduct', (req,res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    const { companyid, name, category, dimensions, unit, stock} = req.body;
    console.log("request.body.name =" ,name);
    console.log("request.body.category =" ,category);
    console.log("request.body.dimensions =" ,dimensions);
    console.log("request.body.companyid =" ,companyid);
    console.log("request.body.unit =" ,unit);
    console.log("request.body.stock =" ,stock);
    db('categories').returning("*").where('name', category).then(data=> {
        console.log("DATA returned from categories")
        console.log("image: ",data[0].image)
        db('products')
        .returning("*")
        .insert({
            companyid: companyid,
            name: name,
            category,
            dimensions,
            unit,
            image: data[0].image,
            stock,
            totalproduced: Number(stock),
            totalsold: 0
        })
        .then(products => {
            console.log("Products")
            console.log("Creating table: ", products[products.length-1].id)
            db.schema.createTable(`_${products[products.length-1].id}`, (table) => {
                table.string('date')
                table.integer('produced')
                table.integer('sold')
                table.integer('stock')
            })
            .then(() =>{})
            .catch(err => console.log("Couldn't create specific table",err))
        })
        .catch(error => res.json("failed adding to products table", error));
    }).catch(err => console.log("couldn't find category stuff", err))
    
})

app.get('/data/:id', (req,res) => {
    console.log("DATA API")
    let id = req.params.id;
    db('products').where('companyid', Number(id)).then(products => {
        db('categories').where('companyid', id).then(categories => {
            const data = {
                categories, 
                products
            }
            res.json(data);
        })
    })
    .catch(error => {
        console.log(error)
        res.json(error)
    })
})

app.get('/products/:id', (req,res) => {
    let id = req.params.id;
    db('products').where('id', id).then((products) => {
        res.json(products[0]);
    })
})

app.get('/getRecord/:id', (req,res) => {
    console.log("GET RECORD API");
    let id = req.params.id;
    db.select('*').table(`_${id}`).then((data)=> {
        res.json(data)
    }).catch((err) => { 
        console.log(err)
    })
})

app.post('/updateRecord/:id', (req,res) => {
    console.log("UPDATE RECORD API");
    let id = req.params.id;
    db.select('*').table(`_${id}`).then((data)=> {
        let {date, produced, sold} = req.body;
        let stock;
        if(data.length !== 0) {
            stock = (Number(data[data.length - 1].stock) + Number(produced)) - Number(sold);
        }
        else {
            stock = produced - sold;
        }

        db(`_${id}`)
        .returning('*')
        .insert({
            date: date, 
            produced: Number(produced), 
            sold: Number(sold),
            stock: Number(stock)
        })
        .then(data => {
            db.select('*').table(`_${id}`).then((data)=> { 
                res.json(data)
            });
        })
        .catch(error => res.json(error));
    });
})
app.listen(process.env.PORT || 3003);


