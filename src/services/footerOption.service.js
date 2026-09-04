const FooterOption = require('../models/FooterOption');

const DEFAULT_FOOTER_OPTIONS = {
  address: '3556 Beech Street, USA',
  supportEmail: 'support@mypetplus.com',
  phoneNumber: '+1 315 369 5943',
  socialLinks: [],
};

const getFooterOptions = async () => {
  const record = await FooterOption.findOne({ key: 'default' })
    .lean()
    .maxTimeMS(2000);

  return {
    ...DEFAULT_FOOTER_OPTIONS,
    ...(record || {}),
    socialLinks: Array.isArray(record?.socialLinks) ? record.socialLinks : [],
  };
};

const normalizeSocialLinks = (links) => {
  if (links === undefined) return undefined;
  if (!Array.isArray(links)) {
    throw new Error('Social media links must be an array');
  }

  return links
    .map((link) => ({
      platform: String(link?.platform || '').trim(),
      url: String(link?.url || '').trim(),
      isActive: link?.isActive !== false,
    }))
    .filter((link) => link.platform || link.url)
    .map((link) => {
      if (!link.platform || !link.url) {
        throw new Error('Each social media link needs a platform and URL');
      }
      try {
        const parsed = new URL(link.url);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
      } catch {
        throw new Error(`Invalid social media URL for ${link.platform}`);
      }
      return link;
    });
};

const updateFooterOptions = async (data = {}) => {
  const address = data.address === undefined ? undefined : String(data.address || '').trim();
  const supportEmail = data.supportEmail === undefined ? undefined : String(data.supportEmail || '').trim().toLowerCase();
  const phoneNumber = data.phoneNumber === undefined ? undefined : String(data.phoneNumber || '').trim();

  if (address !== undefined && address.length > 300) throw new Error('Address is too long');
  if (supportEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    throw new Error('A valid support email is required');
  }
  if (phoneNumber !== undefined && phoneNumber.length > 60) throw new Error('Phone number is too long');

  const update = {};
  if (address !== undefined) update.address = address;
  if (supportEmail !== undefined) update.supportEmail = supportEmail;
  if (phoneNumber !== undefined) update.phoneNumber = phoneNumber;
  const socialLinks = normalizeSocialLinks(data.socialLinks);
  if (socialLinks !== undefined) update.socialLinks = socialLinks;

  const record = await FooterOption.findOneAndUpdate(
    { key: 'default' },
    { $set: update, $setOnInsert: { key: 'default' } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  ).lean();

  return {
    ...DEFAULT_FOOTER_OPTIONS,
    ...(record || {}),
    socialLinks: Array.isArray(record?.socialLinks) ? record.socialLinks : [],
  };
};

module.exports = {
  getFooterOptions,
  updateFooterOptions,
};
