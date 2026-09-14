export default interface Expense {
    id?:string,
    purchase: string,
    purchaseDate: Date,
    payer: string,
    amount: number,
    icon: string
}