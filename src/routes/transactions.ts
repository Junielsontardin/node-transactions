import { FastifyInstance } from 'fastify'
import { knex } from '../database'
import { z } from 'zod'
import { randomUUID } from 'crypto';
import { checkSessionIdExist } from '../middlewares/check-session-id-exist';

export async function transactionsRoutes(app: FastifyInstance) {
  app.get(
    '/', 
    {
      preHandler: [checkSessionIdExist]
    },
    async (request) => {

      const { sessionId } = request.cookies;

      const transactions = await knex('transactions').where('session_id', sessionId).select();

      return {
        totalTransactions: transactions.length,
        transactions
      }
    }
  )

  app.get(
    '/:id', 
    {
      preHandler: [checkSessionIdExist]
    },
    async (request) => {

      const getTransactionSchemaParams = z.object({
        id: z.string().uuid()
      });

      const { id } = getTransactionSchemaParams.parse(request.params);
      const { sessionId } = request.cookies;

      const transaction = await knex('transactions')
      .where({
        id: id,
        session_id: sessionId,
      })
      .first();

      return { transaction };
   }
  )

  app.get(
    '/summary', 
    {
      preHandler: [checkSessionIdExist]
    },
    async (request) => {
      const { sessionId } = request.cookies;

      const summary = await knex('transactions')
      .where('session_id', sessionId)
      .sum('amount', {
        as: 'amount'
      }).first();

      return { summary }
    }
  )

  app.post('/', async (request, reply) => {

    const createTransactionSchema = z.object({
      title: z.string(),
      amount: z.number(),
      type: z.enum(['credit', 'debit'])
    });

    let sessionId = request.cookies.sessionId;

    if(!sessionId) {
      sessionId = randomUUID();

      reply.cookie('sessionId', sessionId, {
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7days
      })
    }

    const { title, amount, type } = createTransactionSchema.parse(request.body);

    await knex('transactions').insert({
      id: randomUUID(),
      title,
      amount: type === "credit" ? amount : amount * -1,
      session_id: sessionId
    });

    return reply.status(201).send();

  })

}
