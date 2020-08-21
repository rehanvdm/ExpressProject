const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model');
const { Op, QueryTypes } = require("sequelize");
const {getProfile} = require('./middleware/getProfile');
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize);
app.set('models', sequelize.models);

/**
 * @returns contract by id
 */
app.get('/contracts/:id',getProfile ,async (req, res) =>{
    const {Contract} = req.app.get('models');
    const {id} = req.params;

    if(id != req.profile.id)
        return res.status(401).end();

    const contract = await Contract.findOne({where: {id}});

    if(!contract)
        return res.status(404).end();

    res.json(contract);
});

/**
 * @returns get a list of contracts by profile id
 */
app.get('/contracts',getProfile ,async (req, res) =>{
    const {Contract, Profile} = req.app.get('models');

    let contracts = [];

    if(req.profile.type === Profile.TYPE.contractor)
        contracts = await Contract.findAll({where: { ContractorId: req.profile.id }});
    else if(req.profile.type === Profile.TYPE.client)
        contracts = await Contract.findAll({where: { ClientId: req.profile.id }});
    else
        return res.status(500).end();

    if(!contracts.length)
        return res.status(404).end();

    res.json(contracts);
});

/**
 * @returns get a list of unpaid jobs for a user, only active contracts
 */
app.get('/jobs/unpaid',getProfile ,async (req, res) =>{
    const {Contract, Job} = req.app.get('models');

    let jobs = await Job.findAll({include: [ { model: Contract, where: { ContractorId: req.profile.id, status: { [Op.ne]: Contract.STATUS.terminated }  }} ],
                               where: { paid: null }});
    if(!jobs.length)
        return res.status(404).end();

    res.json(jobs);
});

/**
 * @returns Pay for a job,
 */
app.post('/jobs/:job_id/pay',getProfile ,async (req, res) =>{
    const {Profile, Contract, Job} = req.app.get('models');
    const {job_id} = req.params;
    const {amount, idempotency_token} = req.body;

    if(!amount)
        return res.status(500).send("Field: amount is required");
    if(!idempotency_token)
        return res.status(500).send("Field: idempotency_token is required");
    if(req.profile.type !== Profile.TYPE.client)
        return res.status(401).end();

    //TODO: Store idempotency token in cache for 24 hours and add condition to no process transaction with that token again


    let job = await Job.findOne({include: [ { model: Contract, where: { ClientId: req.profile.id, status: { [Op.ne]: Contract.STATUS.terminated }  }} ],
                                  where: {id: job_id }});
    if(!job)
        return res.status(404).end();
    if(job.paid)
        return res.status(500).send("Job already paid");
    if(req.profile.balance < job.price)
        return res.status(500).send("Insufficient funds");


    /* Move money from client to contractor, then mark job as paid */
    await sequelize.transaction(async (t) => {
        await job.update({paid: 1, paymentDate: new Date()});

        await Profile.increment({ balance: amount}, { where: {id: job.Contract.ContractorId}});
        await Profile.decrement({ balance: amount}, { where: {id: job.Contract.ClientId}});
    });

    res.json({paid: true});
});

/**
 * @returns Deposit money into client
 */
app.post('/balances/deposit/:userId',getProfile ,async (req, res) =>{
    const {Profile, Contract, Job} = req.app.get('models');
    const {userId} = req.params;
    const {amount, idempotency_token} = req.body;

    if(!amount)
        return res.status(500).send("Field: amount is required");
    if(!idempotency_token)
        return res.status(500).send("Field: idempotency_token is required");

    //TODO: Store idempotency token in cache for 24 hours and add condition to no process transaction with that token again

    //TODO: Make sure that req.profile.id has permissions to deposit into userId profile

    let resp = await Job.findAll({
        include: [ { model: Contract, where: { ClientId: userId, status: { [Op.ne]: Contract.STATUS.terminated }  }} ],
        where: { paid: null },
        attributes: [
            [sequelize.fn('sum', sequelize.col('price')), 'unpaidJobs'],
        ],
        group: ['ClientId'],
    });

    /* If no jobs, then can deposit any amount AND amount must be less than 25% of total jobs to be paid  */
    if(resp && (amount > (resp[0].dataValues.unpaidJobs*0.25)) )
        return res.status(500).send("Deposit must be less than 25% of unpaid jobs");

    // await sequelize.transaction(async (t) => {
        await Profile.increment({ balance: amount}, { where: {id: userId}});
    // });

    res.json({paid: true});
});

/**
 * @returns returns the profession that earned the most money
 */
app.get('/admin/best-profession',getProfile ,async (req, res) =>{
    const {Job, Contract, Profile} = req.app.get('models');
    const { start, end } = req.query;

    if(!start && !Number.isInteger(start))
        return res.status(500).send("Query string param: start is required");
    if(!end && !Number.isInteger(start))
        return res.status(500).send("Query string param: end is required");

    //TODO: Authorize admin queries

    // let resp = await Profile.findAll({
    //     include: [
    //         {
    //             model: Contract,
    //             include: [Job]
    //         },
    //     ],
    //     where: {
    //         paid: {[Op.ne]: null},
    //         [Op.and]: [
    //             {paymentDate: {[Op.gt]: new Date(start)}},
    //             {paymentDate: {[Op.lte]: new Date(end)}}]
    //     },
    //     attributes: [
    //         "proffession",
    //         [sequelize.fn('sum', sequelize.col('price')), 'paid_amount'],
    //     ],
    //     group: ['ContractorId'],
    // });

    const resp = await sequelize.query("SELECT P.profession, SUM(J.price) as profession_paid\n" +
        "FROM Profiles P\n" +
        "INNER JOIN Contracts C on P.id = C.ContractorId\n" +
        "INNER JOIN Jobs J on C.id = J.ContractId\n" +
        "WHERE J.paymentDate > datetime($1,'unixepoch') AND J.paymentDate < datetime($2,'unixepoch')\n" +
        "GROUP BY P.profession\n" +
        "ORDER BY profession_paid DESC\n" +
        "LIMIT 1", {
        bind: [start, end],
        type: QueryTypes.SELECT
    });

    if(!resp.length)
        return res.status(404).end();

    res.json({profession: resp[0].profession});
});

/**
 * @returns returns the clients that paid the most for jobs
 */
app.get('/admin/best-clients',getProfile ,async (req, res) =>{
    const { start, end, limit } = req.query;

    if(!start && !Number.isInteger(start))
        return res.status(500).send("Query string param: start is required");
    if(!end && !Number.isInteger(start))
        return res.status(500).send("Query string param: end is required");
    if(!limit && !Number.isInteger(limit))
        return res.status(500).send("Query string param: limit is required");

    //TODO: Authorize admin queries

    const resp = await sequelize.query("SELECT P.id, firstName || ' ' || lastName AS fullname,  SUM(J.price) as paid\n" +
        "FROM Profiles P\n" +
        "INNER JOIN Contracts C on P.id = C.ClientId\n" +
        "INNER JOIN Jobs J on C.id = J.ContractId\n" +
        "WHERE J.paymentDate > datetime($1,'unixepoch') AND J.paymentDate < datetime($2,'unixepoch')\n" +
        "GROUP BY P.id\n" +
        "ORDER BY paid DESC\n" +
        "LIMIT $3", {
        bind: [start, end, limit],
        type: QueryTypes.SELECT
    });

    if(!resp.length)
        return res.status(404).end();

    res.json(resp);
});


module.exports = app;
