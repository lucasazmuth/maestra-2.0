import { supabase } from '../../lib/supabase';

export interface PlatformReview {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  page_path: string | null;
  created_at: string;
  updated_at: string;
}

export const getMyPlatformReview = async (userId: string): Promise<PlatformReview | null> => {
  const { data, error } = await supabase
    .from('platform_reviews')
    .select('id, user_id, rating, comment, page_path, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as PlatformReview | null;
};

export const savePlatformReview = async ({
  userId,
  rating,
  comment,
  pagePath,
}: {
  userId: string;
  rating: number;
  comment?: string;
  pagePath?: string;
}): Promise<PlatformReview> => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('platform_reviews')
    .upsert(
      {
        user_id: userId,
        rating,
        comment: comment?.trim() || null,
        page_path: pagePath || null,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select('id, user_id, rating, comment, page_path, created_at, updated_at')
    .single();

  if (error) throw error;
  return data as PlatformReview;
};
