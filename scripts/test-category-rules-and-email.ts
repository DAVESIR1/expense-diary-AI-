import { CategoryRuleEngine } from '../src/services/categoryRuleEngine';
import { parseFinancialEmail } from '../src/utils/emailParser';
import { Transaction } from '../src/types';

console.log('====================================================');
console.log('🧪 RUNNING CATEGORY RULE ENGINE & FINANCIAL EMAIL TESTS');
console.log('====================================================\n');

// 1. Test Built-in Category Rules
console.log('1. Testing Built-in ClearSMS Category Rules:');
const swiggyMatch = CategoryRuleEngine.evaluate('HDFC-Bank', 'Paid Rs. 350 to Swiggy on 05-09-2026');
console.log('  Swiggy -> Category:', swiggyMatch?.category);
if (swiggyMatch?.category !== 'Food & Dining') {
  throw new Error(`Expected 'Food & Dining', got '${swiggyMatch?.category}'`);
}

const amazonMatch = CategoryRuleEngine.evaluate('SBI-UPI', 'Sent Rs. 1499 to Amazon Pay India on 05-09-2026');
console.log('  Amazon -> Category:', amazonMatch?.category);
if (amazonMatch?.category !== 'Shopping') {
  throw new Error(`Expected 'Shopping', got '${amazonMatch?.category}'`);
}

const npsSmsMatch = CategoryRuleEngine.evaluate('JD-CBSSBI-S', 'A/C 1234 debited for NPS TIER-I contribution of Rs 10000.00');
console.log('  NPS SMS -> Category:', npsSmsMatch?.category);
if (npsSmsMatch?.category !== 'Investment') {
  throw new Error(`Expected 'Investment', got '${npsSmsMatch?.category}'`);
}

console.log('  ✅ Built-in rules evaluated successfully!\n');

// 2. Test Learning Dynamic Category Rules & Bulk Recategorization
console.log('2. Testing User Rule Learning & Past Recategorization:');
const sampleTransactions: Transaction[] = [
  {
    id: 'tx-1',
    title: 'Payment to Chai Tapri',
    amount: 50,
    category: 'Other',
    type: 'expense',
    date: '2026-09-01',
    time: '10:30',
    paymentMode: 'UPI',
    vendorOrPerson: 'Chai Tapri',
  },
  {
    id: 'tx-2',
    title: 'Payment to Chai Tapri',
    amount: 80,
    category: 'Other',
    type: 'expense',
    date: '2026-09-02',
    time: '16:45',
    paymentMode: 'UPI',
    vendorOrPerson: 'Chai Tapri',
  },
  {
    id: 'tx-3',
    title: 'Uber ride',
    amount: 190,
    category: 'Travel & Fuel',
    type: 'expense',
    date: '2026-09-03',
    time: '08:15',
    paymentMode: 'UPI',
    vendorOrPerson: 'Uber',
  }
];

// Learn rule that "Chai Tapri" is Food & Dining
const newRule = CategoryRuleEngine.learnCategoryRule('Chai Tapri', 'Food & Dining');
console.log('  Learned rule:', newRule.name, '->', newRule.action.category, 'Priority:', newRule.priority);

const { updatedTransactions, updatedCount } = CategoryRuleEngine.recategorizePastTransactions(sampleTransactions, newRule);
console.log(`  Recategorized ${updatedCount} transactions out of ${sampleTransactions.length}`);

if (updatedCount !== 2) {
  throw new Error(`Expected 2 recategorized transactions, got ${updatedCount}`);
}
if (updatedTransactions[0].category !== 'Food & Dining' || updatedTransactions[1].category !== 'Food & Dining') {
  throw new Error('Transaction categories were not updated properly');
}
console.log('  ✅ Dynamic rule learning and bulk recategorization verified!\n');

// 3. Test Financial Email Parser (CRA-NSDL / Protean NPS Contribution)
console.log('3. Testing CRA-NSDL / Protean NPS Contribution Email Parsing:');
const npsEmailSubject = 'Receipt for Contribution under National Pension System (NPS)';
const npsEmailBody = `
Dear Subscriber,
We acknowledge receipt of your contribution of Rs. 50,000.00 under PRAN 110022334455.
Acknowledgement No: ACK987654321
Date of Transaction: 02/09/2026
Your contribution will be invested in accordance with the scheme preferences selected by you.
Regards,
Protean eGov Technologies Limited (formerly NSDL e-Governance Infrastructure Limited)
CRA for National Pension System
`;

const parsedNps = parseFinancialEmail(npsEmailSubject, npsEmailBody, 'cra@proteantech.in', Date.now());
console.log('  Parsed NPS Email:');
console.log('    Title:', parsedNps?.title);
console.log('    Amount:', parsedNps?.amount);
console.log('    Account Info:', parsedNps?.accountInfo);
console.log('    Reference:', parsedNps?.referenceNumber);
console.log('    Category:', parsedNps?.category);

if (!parsedNps || parsedNps.amount !== 50000 || parsedNps.category !== 'Investment') {
  throw new Error('Failed to accurately parse CRA-NSDL NPS contribution email');
}
console.log('  ✅ CRA-NSDL / Protean NPS email parsing verified!\n');

// 4. Test Financial Email Parser (Salary Credit Slip / Advice)
console.log('4. Testing Salary Slip / Credit Advice Email Parsing:');
const salarySubject = 'Salary Slip / Credit Advice for Month of August 2026';
const salaryBody = `
Dear Employee,
Your salary for the month of August 2026 has been processed.
Net Salary Amount: Rs. 57,973.00
Account Credited: A/C ending in 2807 (State Bank of India)
Payment Mode: Direct Bank Credit / NEFT
Transaction Ref / UTR: SBIN8899771122
`;

const parsedSalary = parseFinancialEmail(salarySubject, salaryBody, 'payroll@company.org', Date.now());
console.log('  Parsed Salary Email:');
console.log('    Title:', parsedSalary?.title);
console.log('    Amount:', parsedSalary?.amount);
console.log('    Type:', parsedSalary?.type);
console.log('    Category:', parsedSalary?.category);
console.log('    Ref:', parsedSalary?.referenceNumber);

if (!parsedSalary || parsedSalary.amount !== 57973 || parsedSalary.type !== 'income' || parsedSalary.category !== 'Salary') {
  throw new Error('Failed to accurately parse Salary email');
}
console.log('  ✅ Salary email parsing verified!\n');

console.log('====================================================');
console.log('🎉 ALL AUTO-CATEGORY & EMAIL TESTS PASSED 100%!');
console.log('====================================================');
