'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Box, Button, Stack, Typography } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import Shell from '@/components/shell';
import { dateLabel, ErrorState, LoadingState, PageHeading, Status } from '@/components/ui';
import { useSubmissionDetail } from '@/lib/hooks/useSubmissions';

function Detail() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const from = search.get('from');
  const back = from === '/submissions' || from?.startsWith('/submissions?') ? from : '/submissions';
  const query = useSubmissionDetail(id);
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <>
        <Link href={back} className="back-link">
          Back to submissions
        </Link>
        <ErrorState error={query.error} retry={() => query.refetch()} />
      </>
    );
  const item = query.data;
  return (
    <>
      <Link href={back} className="back-link">
        <ArrowBackRounded sx={{ fontSize: 15 }} /> Back to submissions
      </Link>
      <PageHeading
        eyebrow={`SUBMISSION #${String(item.id).padStart(4, '0')}`}
        title={item.company.legalName}
        description={`${item.company.industry} · ${item.company.headquartersCity}`}
        action={
          <Stack direction="row" spacing={1}>
            <Status value={item.status} />
            <Status value={item.priority} />
          </Stack>
        }
      />
      <div className="detail-grid">
        <div className="detail-stack">
          <section className="panel">
            <div className="panel-heading">
              <Typography variant="h6" component="h2">
                Opportunity overview
              </Typography>
            </div>
            <div className="detail-body">
              <Typography
                sx={{
                  fontSize: 14,
                  lineHeight: 1.85,
                  color: 'text.secondary',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {item.summary || 'No summary has been added.'}
              </Typography>
              <div className="facts" style={{ marginTop: 28 }}>
                {[
                  ['Received', dateLabel(item.createdAt)],
                  ['Last updated', dateLabel(item.updatedAt)],
                  ['Industry', item.company.industry || 'Not provided'],
                  ['Headquarters', item.company.headquartersCity || 'Not provided'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span className="fact-label">{label}</span>
                    <span className="fact-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <Typography variant="h6" component="h2">
                  Supporting documents
                </Typography>
                <p>{item.documents.length} files associated with this submission</p>
              </div>
            </div>
            <div className="detail-body">
              {item.documents.length ? (
                item.documents.map((doc) => {
                  let external = false;
                  try {
                    external = new URL(doc.fileUrl).protocol === 'https:';
                  } catch {}
                  return (
                    <div className="doc-row" key={doc.id}>
                      <DescriptionOutlined sx={{ color: 'primary.main' }} />
                      <div>
                        <Typography variant="body2" fontWeight={600}>
                          {doc.title}
                        </Typography>
                        <span className="subtext">
                          {doc.docType} · {dateLabel(doc.uploadedAt)}
                          {doc.downloadUrl ? ' · Sample file' : ''}
                        </span>
                      </div>
                      {doc.downloadUrl ? (
                        <Button
                          component="a"
                          href={doc.downloadUrl}
                          size="small"
                          startIcon={<DownloadRounded />}
                          aria-label={`Download ${doc.title}`}
                        >
                          Download
                        </Button>
                      ) : external ? (
                        <Button
                          component="a"
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          endIcon={<OpenInNewRounded />}
                        >
                          Open
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          File unavailable
                        </Typography>
                      )}
                    </div>
                  );
                })
              ) : (
                <Typography color="text.secondary" variant="body2">
                  No documents have been attached yet.
                </Typography>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <Typography variant="h6" component="h2">
                  Notes & activity
                </Typography>
                <p>Latest context from your team</p>
              </div>
              <Typography variant="caption" color="text.secondary">
                {item.notes.length} notes
              </Typography>
            </div>
            <div className="detail-body">
              {item.notes.length ? (
                item.notes.map((note) => (
                  <article key={note.id} className="timeline-item">
                    <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={1}>
                      <Typography variant="body2" fontWeight={600}>
                        {note.authorName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dateLabel(note.createdAt)}
                      </Typography>
                    </Stack>
                    <Typography
                      sx={{
                        fontSize: 13,
                        lineHeight: 1.8,
                        color: 'text.secondary',
                        mt: 1,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {note.body}
                    </Typography>
                  </article>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No notes yet. New context will appear here.
                </Typography>
              )}
            </div>
          </section>
        </div>
        <aside className="detail-stack">
          <section className="panel">
            <div className="panel-heading">
              <Typography variant="h6" component="h2">
                People on this opportunity
              </Typography>
            </div>
            <div className="detail-body">
              <span className="fact-label">BROKER</span>
              <Typography variant="body2" fontWeight={600}>
                {item.broker.name}
              </Typography>
              {item.broker.primaryContactEmail && (
                <Box
                  component="a"
                  sx={{
                    fontSize: 12,
                    color: 'primary.main',
                    overflowWrap: 'anywhere',
                    display: 'block',
                    mt: 1,
                  }}
                  href={`mailto:${item.broker.primaryContactEmail}`}
                >
                  {item.broker.primaryContactEmail}
                </Box>
              )}
              <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                <span className="fact-label">INTERNAL OWNER</span>
                <Typography variant="body2" fontWeight={600}>
                  {item.owner.fullName}
                </Typography>
                <Box
                  component="a"
                  sx={{
                    fontSize: 12,
                    color: 'primary.main',
                    overflowWrap: 'anywhere',
                    display: 'block',
                    mt: 1,
                  }}
                  href={`mailto:${item.owner.email}`}
                >
                  {item.owner.email}
                </Box>
              </Box>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <Typography variant="h6" component="h2">
                Company contacts
              </Typography>
            </div>
            <div className="detail-body">
              {item.contacts.length ? (
                item.contacts.map((contact) => (
                  <div className="contact-card" key={contact.id}>
                    <Typography variant="body2" fontWeight={600}>
                      {contact.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {contact.role}
                    </Typography>
                    <Stack
                      spacing={1}
                      sx={{
                        mt: 1.5,
                        fontSize: 12,
                        color: 'primary.main',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
                      {contact.phone && (
                        <a href={`tel:${contact.phone.replace(/[^+0-9]/g, '')}`}>{contact.phone}</a>
                      )}
                    </Stack>
                  </div>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No contacts provided.
                </Typography>
              )}
            </div>
          </section>
          <Typography variant="caption" sx={{ px: 1, lineHeight: 1.8, color: 'text.secondary' }}>
            This workspace is for reviewing submissions. Contact the internal owner to request
            changes.
          </Typography>
        </aside>
      </div>
    </>
  );
}
export default function Page() {
  return (
    <Shell>
      <Suspense fallback={<LoadingState />}>
        <Detail />
      </Suspense>
    </Shell>
  );
}
