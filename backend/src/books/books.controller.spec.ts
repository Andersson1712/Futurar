import { ExecutionContext, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../app.setup';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

interface AuthenticatedTestRequest {
  user?: { id: string };
}

describe('BooksController', () => {
  let app: INestApplication<App>;
  const list = jest.fn();
  const get = jest.fn();
  const remove = jest.fn();
  const saveDedication = jest.fn();
  const clearDedication = jest.fn();
  const setFavorite = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        ConfigService,
        SupabaseService,
        {
          provide: BooksService,
          useValue: {
            list,
            get,
            remove,
            saveDedication,
            clearDedication,
            setFavorite,
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest<AuthenticatedTestRequest>().user = {
            id: 'user-1',
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists the authenticated user books', async () => {
    list.mockResolvedValue([{ id: 'book-1', title: 'Cuento' }]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/books')
      .expect(200);

    expect(response.body).toEqual([{ id: 'book-1', title: 'Cuento' }]);
    expect(list).toHaveBeenCalledWith('user-1', undefined);
  });

  it('filters by profileId and validates it', async () => {
    list.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/books?profileId=123e4567-e89b-42d3-a456-426614174000')
      .expect(200);
    expect(list).toHaveBeenCalledWith(
      'user-1',
      '123e4567-e89b-42d3-a456-426614174000',
    );

    const invalid = await request(app.getHttpServer())
      .get('/api/v1/books?profileId=not-a-uuid')
      .expect(400);
    expect(invalid.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('returns book details', async () => {
    get.mockResolvedValue({ id: 'book-1', pages: [] });

    const response = await request(app.getHttpServer())
      .get('/api/v1/books/book-1')
      .expect(200);

    expect(response.body).toEqual({ id: 'book-1', pages: [] });
    expect(get).toHaveBeenCalledWith('book-1', 'user-1');
  });

  it('soft deletes books with 204', async () => {
    remove.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/books/book-1')
      .expect(204);

    expect(remove).toHaveBeenCalledWith('book-1', 'user-1');
  });

  it('saves and clears a dedication', async () => {
    saveDedication.mockResolvedValue({ id: 'book-1', dedicationTo: 'Ana' });
    clearDedication.mockResolvedValue({ id: 'book-1' });

    const saved = await request(app.getHttpServer())
      .put('/api/v1/books/book-1/dedication')
      .send({ to: 'Ana', reason: 'su cumple', position: 'start' })
      .expect(200);

    expect(saved.body).toMatchObject({ dedicationTo: 'Ana' });
    expect(saveDedication).toHaveBeenCalledWith('book-1', 'user-1', {
      to: 'Ana',
      reason: 'su cumple',
      position: 'start',
    });

    await request(app.getHttpServer())
      .delete('/api/v1/books/book-1/dedication')
      .expect(200);
    expect(clearDedication).toHaveBeenCalledWith('book-1', 'user-1');
  });

  it('validates the dedication payload', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/books/book-1/dedication')
      .send({ to: '', position: 'middle' })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('toggles the favorite flag', async () => {
    setFavorite.mockResolvedValue({ id: 'book-1', isFavorite: true });

    const response = await request(app.getHttpServer())
      .put('/api/v1/books/book-1/favorite')
      .send({ isFavorite: true })
      .expect(200);

    expect(response.body).toMatchObject({ isFavorite: true });
    expect(setFavorite).toHaveBeenCalledWith('book-1', 'user-1', true);
  });
});
