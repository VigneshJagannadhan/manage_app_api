import { Schema, model, Document } from 'mongoose';

export enum ExpenseCategory {
  FOOD = 'FOOD',
  TRANSPORT = 'TRANSPORT',
  SHOPPING = 'SHOPPING',
  BILLS = 'BILLS',
  ENTERTAINMENT = 'ENTERTAINMENT',
  HEALTH = 'HEALTH',
  OTHER = 'OTHER',
}

export interface IExpensePayer {
  contactId: string | null;
}

export interface IExpenseSplit {
  contactId: string | null;
  amountOwed: number;
}

export interface IExpense extends Document {
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: Date;
  createdAt: Date;
  payer: IExpensePayer;
  splits: IExpenseSplit[];
  userId: string;
}

const payerSchema = new Schema<IExpensePayer>(
  {
    contactId: { type: String, default: null },
  },
  { _id: false },
);

const splitSchema = new Schema<IExpenseSplit>(
  {
    contactId: { type: String, default: null },
    amountOwed: { type: Number, required: true },
  },
  { _id: false },
);

const expenseSchema = new Schema<IExpense>({
  title: { type: String, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  category: { type: String, enum: Object.values(ExpenseCategory), required: true },
  date: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  payer: { type: payerSchema, default: () => ({ contactId: null }) },
  splits: { type: [splitSchema], default: [] },
  userId: { type: String, required: true },
});

export const Expense = model<IExpense>('Expense', expenseSchema);
