import { Inject, Injectable } from '@nestjs/common';
import { AiErrorException } from '../common/errors/ai-error.exception';
import { CONTACT_REPOSITORY } from './contacts.repository';
import type { ContactRepository, ProfileContact } from './contacts.repository';
import { PROFILE_REPOSITORY } from './profile.repository';
import type { ProfileRepository } from './profile.repository';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contacts: ContactRepository,
    @Inject(PROFILE_REPOSITORY)
    private readonly profiles: ProfileRepository,
  ) {}

  async list(profileId: string, teacherId: string): Promise<ProfileContact[]> {
    await this.assertProfileOwner(profileId, teacherId);

    return this.contacts.list(profileId);
  }

  async create(
    profileId: string,
    teacherId: string,
    dto: CreateContactDto,
  ): Promise<ProfileContact> {
    await this.assertProfileOwner(profileId, teacherId);

    return this.contacts.create(profileId, dto);
  }

  async update(
    contactId: string,
    teacherId: string,
    dto: UpdateContactDto,
  ): Promise<ProfileContact> {
    const contact = await this.contacts.findById(contactId);

    if (!contact) throw contactNotFound();

    await this.assertProfileOwner(contact.profileId, teacherId);

    const updated = await this.contacts.update(contactId, dto);

    if (!updated) throw contactNotFound();

    return updated;
  }

  async remove(contactId: string, teacherId: string): Promise<void> {
    const contact = await this.contacts.findById(contactId);

    if (!contact) throw contactNotFound();

    await this.assertProfileOwner(contact.profileId, teacherId);

    const removed = await this.contacts.remove(contactId);

    if (!removed) throw contactNotFound();
  }

  private async assertProfileOwner(
    profileId: string,
    teacherId: string,
  ): Promise<void> {
    const profile = await this.profiles.findById(profileId, teacherId);

    if (!profile) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Profile not found');
    }
  }
}

function contactNotFound(): AiErrorException {
  return new AiErrorException(404, 'NOT_FOUND', 'Contact not found');
}
