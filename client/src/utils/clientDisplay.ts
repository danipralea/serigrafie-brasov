/**
 * Client naming helpers.
 *
 * The company is what the team recognises a client by (e.g. "Poleposition",
 * "Jars"), so it is always shown as the primary label, with the contact
 * person's name as secondary information. Clients without a company fall back
 * to the person's name.
 */

interface ClientLike {
  name?: string;
  company?: string;
}

interface OrderLike {
  clientName?: string;
  clientCompany?: string;
}

function clean(value?: string): string {
  return (value || '').trim();
}

/** Main label for a client: company if known, otherwise the person's name. */
export function getClientPrimaryName(client?: ClientLike | null): string {
  if (!client) return '';
  return clean(client.company) || clean(client.name);
}

/** Secondary label: the contact person, only when a company is shown above. */
export function getClientSecondaryName(client?: ClientLike | null): string {
  if (!client) return '';
  return clean(client.company) ? clean(client.name) : '';
}

/** Main label for an order's client. */
export function getOrderClientPrimaryName(order?: OrderLike | null): string {
  if (!order) return '';
  return clean(order.clientCompany) || clean(order.clientName);
}

/** Secondary label for an order's client. */
export function getOrderClientSecondaryName(order?: OrderLike | null): string {
  if (!order) return '';
  return clean(order.clientCompany) ? clean(order.clientName) : '';
}

/** Initials built from whatever label is displayed first. */
export function getDisplayInitials(name?: string): string {
  const value = clean(name);
  if (!value) return '?';
  const parts = value.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return value.substring(0, 2).toUpperCase();
}
