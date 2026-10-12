import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ContactRepository,
  CreateContactInput,
  ProfileContact,
  UpdateContactInput,
} from './contacts.repository';

@Injectable()
export class InMemoryContactRepository implements ContactRepository {
  private readonly contacts = new Map<string, ProfileContact>();

  list(profileId: string): Promise<ProfileContact[]> {
    const list = [...this.contacts.values()]
      .filter((contact) => contact.profileId === profileId)
      .sort((a, b) => a.name.localeCompare(b.name));

    return Promise.resolve(list);
  }

  findById(contactId: string): Promise<ProfileContact | undefined> {
    return Promise.resolve(this.contacts.get(contactId));
  }

  create(
    profileId: string,
    input: CreateContactInput,
  ): Promise<ProfileContact> {
    const now = new Date();
    const contact: ProfileContact = {
      id: randomUUID(),
      profileId,
      name: input.name,
      relationship: input.relationship,
      dedicationReason: input.dedicationReason,
      createdAt: now,
      updatedAt: now,
    };

    this.contacts.set(contact.id, contact);

    return Promise.resolve(contact);
  }

  update(
    contactId: string,
    patch: UpdateContactInput,
  ): Promise<ProfileContact | undefined> {
    const contact = this.contacts.get(contactId);

    if (!contact) return Promise.resolve(undefined);

    Object.assign(contact, stripUndefined(patch), { updatedAt: new Date() });

    return Promise.resolve(contact);
  }

  remove(contactId: string): Promise<boolean> {
    return Promise.resolve(this.contacts.delete(contactId));
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
