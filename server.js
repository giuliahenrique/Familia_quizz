import Fastify from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';
import * as dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg;

const fastify =Fastify();

await fastify.register(cors, {
  origin: '*'
})

const pool = new Pool({
  connectionString: process.env.url_bd,
  ssl: {
      rejectUnauthorized: false
  }
})

// const db = new Pool({
//   user: 'postgres',
//   password: 'senai',
//   host: 'localhost',
//   port: 5432,
//   database: 'familia'
// });

const formRepository = {
  async create(title, studentName) {
    const query = 'INSERT INTO forms (title, student_name) VALUES ($1, $2) RETURNING *';
    const values = [title, studentName];
    const { rows } = await db.query(query, values);
    return rows[0];
  },
  
  async getRankingByFormId(formId) {
    const query = 'SELECT respondent_name, score FROM attempts WHERE form_id = $1 ORDER BY score DESC';
    const { rows } = await db.query(query, [formId]);
    return rows;
  }
};

const questionRepository = {
  async create(formId, text, optionA, optionB, optionC, optionD, correctOption) {
    const query = `
      INSERT INTO questions 
      (form_id, question_text, option_a, option_b, option_c, option_d, correct_option) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `;
    const values = [formId, text, optionA, optionB, optionC, optionD, correctOption];
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  async getQuestionsByFormId(formId) {
    const query = 'SELECT * FROM questions WHERE form_id = $1';
    const { rows } = await db.query(query, [formId]);
    return rows;
  }
};

const attemptRepository = {
  async create(formId, respondentName, score) {
    const query = 'INSERT INTO attempts (form_id, respondent_name, score) VALUES ($1, $2, $3) RETURNING *';
    const values = [formId, respondentName, score];
    const { rows } = await db.query(query, values);
    return rows[0];
  }
};

const createFormUseCase = async (repository, data) => {
  return await repository.create(data.title, data.studentName);
};

const createQuestionUseCase = async (repository, data) => {
  return await repository.create(
    data.formId, 
    data.questionText, 
    data.optionA, 
    data.optionB, 
    data.optionC, 
    data.optionD, 
    data.correctOption
  );
};

const submitAttemptUseCase = async (questionRepo, attemptRepo, data) => {
  const questions = await questionRepo.getQuestionsByFormId(data.formId);
  let score = 0;

  for (const answer of data.answers) {
    const question = questions.find(q => q.id === answer.questionId);
    if (question && question.correct_option === answer.selectedOption) {
      score += 1;
    }
  }

  return await attemptRepo.create(data.formId, data.respondentName, score);
};

const getRankingUseCase = async (repository, formId) => {
  return await repository.getRankingByFormId(formId);
};

const app = Fastify({ logger: true });
await app.register(cors, { origin: '*' });

app.post('/forms', async (request, reply) => {
  const result = await createFormUseCase(formRepository, request.body);
  return reply.code(201).send(result);
});

app.post('/questions', async (request, reply) => {
  const result = await createQuestionUseCase(questionRepository, request.body);
  return reply.code(201).send(result);
});

app.post('/attempts', async (request, reply) => {
  const result = await submitAttemptUseCase(questionRepository, attemptRepository, request.body);
  return reply.code(201).send(result);
});

app.get('/forms/:formId/ranking', async (request, reply) => {
  const { formId } = request.params;
  const result = await getRankingUseCase(formRepository, formId);
  return reply.send(result);
});

await app.listen({ port: 3000, host: '0.0.0.0' });