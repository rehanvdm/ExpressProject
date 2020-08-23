const spawn = require('child_process').spawn;

const { v4: uuidv4 } = require('uuid');
const app = require("../src/app");
const chai = require("chai");
const chaiHttp = require("chai-http");

const { expect } = chai;
chai.use(chaiHttp);



let contractorId = 8;
let contractorContractId = 9;
let contractorId_UnpaidJobs = 6;
let contractorId_UnpaidJobs_TerminatedContract = 1;
let clientId  = 1;
let clientContractId  = 2;
let jobId_PayJob_ContractTerminated_Unpaid = 9; /* for clientId 1 */
let jobId_PayJob_ContractInProgress_Unpaid = 2; /* for clientId 1 */
let jobId_PayJob_ContractInProgress_Paid = 12; /* for clientId 1 */

let depositAmountLessThan25Percent = 50; /* For clientId 1 */
let depositAmountMoreThan25Percent = 1000; /* For clientId 1 */

async function commandExec(cmd, args, cwd, echoOutputs = true)
{
    return new Promise((resolve, reject) =>
    {
        let allData = "";
        const call = spawn(cmd, args, {shell: true, windowsVerbatimArguments: true, cwd: cwd});
        let errOutput = null;

        call.stdout.on('data', function (data)
        {
            allData += data.toString();
            echoOutputs && process.stdout.write(data.toString());
        });
        call.stderr.on('data', function (data)
        {
            errOutput = data.toString();
            echoOutputs && process.stdout.write(data.toString());
        });
        call.on('exit', function (code)
        {
            if (code == 0)
                resolve(allData);
            else
                reject(errOutput);
        });
    });
}


describe("Contracts", () => {

    before(async function(){
        await commandExec("npm", ["run", "seed"],null,false);
    });

    it("Positive - Get by id - Contractor", done => {
        chai
            .request(app)
            .get("/contracts/"+contractorContractId)
            .set('profile_id', contractorId)
            .end((err, res) => {
                expect(res).to.have.status(200);

                expect(res.body.id).to.be.an("number");
                expect(res.body.terms).to.be.an("string");
                expect(res.body.status).to.be.an("string");
                expect(res.body.createdAt).to.be.an("string");
                expect(res.body.updatedAt).to.be.an("string");
                expect(res.body.ContractorId).to.be.an("number");
                expect(res.body.ClientId).to.be.an("number");

                expect(res.body.ContractorId).to.equals(contractorId);
                done();
            });
    });
    it("Positive - Get by id - Client", done => {
        chai
            .request(app)
            .get("/contracts/"+clientContractId)
            .set('profile_id', clientId)
            .end((err, res) => {
                expect(res).to.have.status(200);

                expect(res.body.id).to.be.an("number");
                expect(res.body.terms).to.be.an("string");
                expect(res.body.status).to.be.an("string");
                expect(res.body.createdAt).to.be.an("string");
                expect(res.body.updatedAt).to.be.an("string");
                expect(res.body.ContractorId).to.be.an("number");
                expect(res.body.ClientId).to.be.an("number");

                expect(res.body.ClientId).to.equals(clientId);
                done();
            });
    });
    it("Negative - Can not get another contracts information if it does not belong to that contractor", done => {
        chai
            .request(app)
            .get("/contracts/"+clientContractId)
            .set('profile_id', contractorId)
            .end((err, res) => {
                expect(res).to.have.status(401);

                done();
            });
    });

    it("Positive - Get all contracts for CONTRACTOR profile", done => {
        chai
            .request(app)
            .get("/contracts")
            .set('profile_id', contractorId)
            .end((err, res) => {
                expect(res).to.have.status(200);

                expect(res.body).to.be.an("array");
                expect(res.body[0].id).to.be.an("number");
                expect(res.body[0].terms).to.be.an("string");
                expect(res.body[0].status).to.be.an("string");
                expect(res.body[0].createdAt).to.be.an("string");
                expect(res.body[0].updatedAt).to.be.an("string");
                expect(res.body[0].ContractorId).to.be.an("number");
                expect(res.body[0].ClientId).to.be.an("number");

                expect(res.body[0].ContractorId).to.equals(contractorId);
                done();
            });
    });
    it("Positive - Get all contracts for CLIENT profile", done => {
        chai
            .request(app)
            .get("/contracts")
            .set('profile_id', clientId)
            .end((err, res) => {
                expect(res).to.have.status(200);

                expect(res.body).to.be.an("array");
                expect(res.body[0].id).to.be.an("number");
                expect(res.body[0].terms).to.be.an("string");
                expect(res.body[0].status).to.be.an("string");
                expect(res.body[0].createdAt).to.be.an("string");
                expect(res.body[0].updatedAt).to.be.an("string");
                expect(res.body[0].ContractorId).to.be.an("number");
                expect(res.body[0].ClientId).to.be.an("number");

                expect(res.body[0].ClientId).to.equals(clientId);
                done();
            });
    });

});

describe("Jobs", () => {

    before(async function(){
        await commandExec("npm", ["run", "seed"],null,false);
    });

    it("Positive - Get all unpaid jobs for Contractor", done => {
        chai
            .request(app)
            .get("/jobs/unpaid")
            .set('profile_id', contractorId_UnpaidJobs)
            .end((err, res) => {
                expect(res).to.have.status(200);


                expect(res.body).to.be.an("array");
                expect(res.body[0].id).to.be.an("number");
                expect(res.body[0].description).to.be.an("string");
                expect(res.body[0].price).to.be.an("number");
                expect(res.body[0].createdAt).to.be.an("string");
                expect(res.body[0].updatedAt).to.be.an("string");
                expect(res.body[0].ContractId).to.be.an("number");

                expect(res.body.length).to.equals(2);
                expect(res.body[0].paid).to.equals(null);
                expect(res.body[0].paymentDate).to.equals(null);
                done();
            });
    });
    it("Positive - Get all unpaid jobs for Client", done => {
        chai
            .request(app)
            .get("/jobs/unpaid")
            .set('profile_id', clientId)
            .end((err, res) => {
                expect(res).to.have.status(200);


                expect(res.body).to.be.an("array");
                expect(res.body[0].id).to.be.an("number");
                expect(res.body[0].description).to.be.an("string");
                expect(res.body[0].price).to.be.an("number");
                expect(res.body[0].createdAt).to.be.an("string");
                expect(res.body[0].updatedAt).to.be.an("string");
                expect(res.body[0].ContractId).to.be.an("number");

                expect(res.body.length).to.equals(1);
                expect(res.body[0].paid).to.equals(null);
                expect(res.body[0].paymentDate).to.equals(null);
                done();
            });
    });
    it("Negative - Get all unpaid jobs for profile, excluding terminated contracts", done => {
        chai
            .request(app)
            .get("/jobs/unpaid")
            .set('profile_id', contractorId_UnpaidJobs_TerminatedContract)
            .end((err, res) => {
                expect(res).to.have.status(200);

                done();
            });
    });

    it("Positive - Pay for unpaid job, contract in progress", done => {
        chai
            .request(app)
            .post("/jobs/" + jobId_PayJob_ContractInProgress_Unpaid + "/pay")
            .set('profile_id', clientId)
            .send({
                idempotency_token: uuidv4(),
            })
            .end((err, res) => {
                expect(res).to.have.status(200);

                expect(res.body.paid).to.be.an("boolean");
                expect(res.body.paid).to.equals(true);

                //TODO: Query the DB and make sure that contractor with profile id 6 now has balance of 1415 (1214+201)
                //TODO: Query the DB and make sure that client with profile id 1 now has balance of 949 (1150-201)
                //TODO: Query the DB and make sure that job with id of 2 has been payed and has payment date

                done();
            });
    });
    it("Negative - PAy, Idempotency token is missing", done => {
        chai
            .request(app)
            .post("/jobs/" + jobId_PayJob_ContractInProgress_Unpaid + "/pay")
            .set('profile_id', clientId)
            .send({
                // idempotency_token: uuidv4(),
            })
            .end((err, res) => {
                expect(res).to.have.status(500);
                expect(res.text).to.equals("Field: idempotency_token is required");
                done();
            });
    });
    it("Negative - Pay for already paid job, contract in progress", done => {
        chai
            .request(app)
            .post("/jobs/" + jobId_PayJob_ContractInProgress_Paid + "/pay")
            .set('profile_id', clientId)
            .send({
                idempotency_token: uuidv4(),
            })
            .end((err, res) => {
                expect(res).to.have.status(500);
                expect(res.text).to.equals("Job already paid");
                done();
            });
    });
    it("Negative - Pay for unpaid job, contract terminated", done => {
        chai
            .request(app)
            .post("/jobs/" + jobId_PayJob_ContractTerminated_Unpaid + "/pay")
            .set('profile_id', clientId)
            .send({
                idempotency_token: uuidv4(),
            })
            .end((err, res) => {
                expect(res).to.have.status(404);
                done();
            });
    });

});


describe("Balances", () => {

    before(async function(){
        await commandExec("npm", ["run", "seed"],null,false);
    });

    it("Positive - Deposit money into balance of client, less than 25% of all his total unpaid jobs", done => {
        chai
            .request(app)
            .post("/balances/deposit/" + clientId)
            .set('profile_id', clientId)
            .send({
                amount: depositAmountLessThan25Percent,
                idempotency_token: uuidv4(),
            })
            .end((err, res) => {
                expect(res).to.have.status(200);

                expect(res.body.paid).to.be.an("boolean");
                expect(res.body.paid).to.equals(true);

                //TODO: Query the DB and make sure that client with profile id 1 now has balance of 1200 (1150+50)

                done();
            });
    });

    it("Negative - Can not Deposit money into balance of client, more than 25% of all his total unpaid jobs", done => {
        chai
            .request(app)
            .post("/balances/deposit/" + clientId)
            .set('profile_id', clientId)
            .send({
                amount: depositAmountMoreThan25Percent,
                idempotency_token: uuidv4(),
            })
            .end((err, res) => {
                expect(res).to.have.status(500);
                expect(res.text).to.equals("Deposit must be less than 25% of unpaid jobs");
                done();
            });
    });

});

describe("Admin", () => {

    before(async function(){
        await commandExec("npm", ["run", "seed"],null,false);
    });

    let startDate = 1597449600;//2020-08-15T00:00:00+00:00
    let endDate = 1597881600;//2020-08-20T00:00:00+00:00

    it("Positive - Most highly paid profession", done => {
        chai
            .request(app)
            .get("/admin/best-profession?start="+startDate+"&end="+endDate)
            .set('profile_id', clientId)
            .send({
                amount: depositAmountLessThan25Percent,
                idempotency_token: uuidv4(),
            })
            .end((err, res) => {
                expect(res).to.have.status(200);

                expect(res.body.profession).to.be.an("string");
                expect(res.body.profession).to.equals("Programmer");
                done();
            });
    });

    let limit = 2;

    it("Positive - Clients that paid the most for jobs", done => {
        chai
            .request(app)
            .get("/admin/best-clients?start="+startDate+"&end="+endDate+"&limit=" + limit)
            .set('profile_id', clientId)
            .send({
                amount: depositAmountLessThan25Percent,
                idempotency_token: uuidv4(),
            })
            .end((err, res) => {
                expect(res).to.have.status(200);

                expect(res.body.length).to.equal(limit);
                expect(res.body[0].id).to.be.an("number");
                expect(res.body[0].fullname).to.be.an("string");
                expect(res.body[0].paid).to.be.an("number");
                done();
            });
    });
});