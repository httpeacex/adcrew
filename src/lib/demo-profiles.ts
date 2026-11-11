import type { Profile } from './workflow.ts';

export const demoProfiles: Profile[] = [
  { id: 1, name: 'Анна Волкова', initials: 'АВ', color: 'violet', email: 'anna@kadr.demo', role: 'buyer' },
  { id: 2, name: 'Макс Соколов', initials: 'МС', color: 'sand', email: 'max@kadr.demo', role: 'buyer' },
  { id: 3, name: 'Лера Ким', initials: 'ЛК', color: 'mint', email: 'lera@kadr.demo', role: 'creative' },
  { id: 4, name: 'Никита Орлов', initials: 'НО', color: 'blue', email: 'nikita@kadr.demo', role: 'creative' },
  { id: 5, name: 'Саша Миронов', initials: 'СМ', color: 'violet', email: 'sasha@kadr.demo', role: 'lead' },
];
