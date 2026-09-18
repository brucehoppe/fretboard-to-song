import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export const setup = () => userEvent.setup({ pointerEventsCheck: 0 });
export type User = ReturnType<typeof setup>;

/** Pick an option in a labelled Radix Select. */
export async function choose(user: User, label: string | RegExp, option: string | RegExp, scope: HTMLElement = document.body) {
  await user.click(within(scope).getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}
/** All option labels of a labelled Radix Select (opens and closes it). */
export async function optionsOf(user: User, label: string | RegExp, scope: HTMLElement = document.body) {
  await user.click(within(scope).getByRole('combobox', { name: label }));
  const names = (await screen.findAllByRole('option')).map(o => o.textContent ?? '');
  await user.keyboard('{Escape}');
  return names;
}
export const selected = (label: string | RegExp, scope: HTMLElement = document.body) =>
  within(scope).getByRole('combobox', { name: label }).textContent;
