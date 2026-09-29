use tokio::sync::mpsc;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReliableQueueError {
    Closed,
}

pub fn try_enqueue_reliable<T, F>(
    sender: &mpsc::Sender<T>,
    build: F,
) -> Result<bool, ReliableQueueError>
where
    F: FnOnce() -> T,
{
    match sender.try_reserve() {
        Ok(permit) => {
            permit.send(build());
            Ok(true)
        }
        Err(mpsc::error::TrySendError::Full(_)) => Ok(false),
        Err(mpsc::error::TrySendError::Closed(_)) => Err(ReliableQueueError::Closed),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    #[test]
    fn full_queue_skips_expensive_builder() {
        let (sender, mut receiver) = mpsc::channel(1);
        sender.try_send(vec![1]).expect("prime queue");
        let builds = Cell::new(0_u32);

        let queued = try_enqueue_reliable(&sender, || {
            builds.set(builds.get() + 1);
            vec![2]
        })
        .expect("open queue");

        assert!(!queued);
        assert_eq!(builds.get(), 0);
        assert_eq!(receiver.try_recv().expect("primed payload"), vec![1]);

        let queued = try_enqueue_reliable(&sender, || {
            builds.set(builds.get() + 1);
            vec![3]
        })
        .expect("open queue");
        assert!(queued);
        assert_eq!(builds.get(), 1);
        assert_eq!(receiver.try_recv().expect("built payload"), vec![3]);
    }
}
