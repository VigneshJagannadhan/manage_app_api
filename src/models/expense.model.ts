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
  userId: string;
}

export interface IExpenseSplit {
  userId: string;
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
  groupId: string;
  userId: string;
}

const payerSchema = new Schema<IExpensePayer>(
  {
    userId: { type: String, required: true },
  },
  { _id: false },
);

const splitSchema = new Schema<IExpenseSplit>(
  {
    userId: { type: String, required: true },
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
  payer: { type: payerSchema, required: true },
  splits: { type: [splitSchema], default: [] },
  groupId: { type: String, required: true },
  userId: { type: String, required: true },
});

expenseSchema.index({ groupId: 1, createdAt: -1 });

export const Expense = model<IExpense>('Expense', expenseSchema);
