import { notFound } from "next/navigation";
import { getBookingLink, listBookingAppointments } from "@/lib/db";
import { BookingLinkEditor } from "@/components/capture/BookingLinkEditor";

export const dynamic = "force-dynamic";

export default async function BookingLinkEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [link, appointments] = await Promise.all([
    getBookingLink(id),
    listBookingAppointments({ bookingLinkId: id }),
  ]);
  if (!link) notFound();

  return <BookingLinkEditor link={link} appointments={appointments} />;
}
