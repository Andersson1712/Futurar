export const CONTACT_REPOSITORY = Symbol('CONTACT_REPOSITORY');

export interface ProfileContact {
  id: string;
  profileId: string;
  name: string;
  relationship: string;
  dedicationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContactInput {
  name: string;
  relationship: string;
  dedicationReason?: string;
}

export interface UpdateContactInput {
  name?: string;
  relationship?: string;
  dedicationReason?: string;
}

export interface ContactRepository {
  list(profileId: string): Promise<ProfileContact[]>;
  findById(contactId: string): Promise<ProfileContact | undefined>;
  create(profileId: string, input: CreateContactInput): Promise<ProfileContact>;
  update(
    contactId: string,
    patch: UpdateContactInput,
  ): Promise<ProfileContact | undefined>;
  remove(contactId: string): Promise<boolean>;
}
