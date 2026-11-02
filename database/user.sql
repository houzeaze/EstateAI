create table if not exists expenses(
    id serial primary key,
    category varchar(100) not null,
    description text,
    amount decimal(10, 2) not null check (amount >= 0),
    expense_date date not null,
    paid_to varchar(100),
    payment_method varchar(50)
);


INSERT INTO expenses
    (category, description, amount, expense_date, paid_to, payment_method)
VALUES
    ('Marketing', 'Property advertising campaign', 25000, '2026-10-01', 'Bright Media', 'Bank Transfer'),
    ('Office Rent', 'Monthly office rent', 45000, '2026-10-02', 'ABC Properties', 'Bank Transfer'),
    ('Travel', 'Property site visit', 3500, '2026-10-03', 'City Cabs', 'UPI'),
    ('Software', 'CRM subscription', 8500, '2026-10-04', 'CloudTech Solutions', 'UPI'),
    ('Utilities', 'Office electricity bill', 6200, '2026-10-05', 'Utility Provider', 'UPI');
