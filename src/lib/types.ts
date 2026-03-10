export type Task = {
  id: string;
  date: string; // YYYY-MM-DD (local calendar day)
  title: string;
  description?: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Holiday = {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
};

export type Country = {
  countryCode: string;
  name: string;
};

