"""One-time script to populate words_table from the english_words package.

Run from inside backend/:
    python seed_words.py
"""
from english_words import get_english_words_set

from database import SessionLocal, WordDb

TARGET_LENGTHS = (4, 5, 6)


def load_candidate_words():
    # web2 = the (large) /usr/share/dict/words style wordlist bundled with the package
    raw = get_english_words_set(["web2"], lower=False)
    words = set()
    for w in raw:
        if not w.isalpha():
            continue
        if not w.islower():
            # drops proper nouns / acronyms, which get_english_words_set keeps capitalized
            continue
        if len(w) in TARGET_LENGTHS:
            words.add(w)
    return words


def main():
    candidates = load_candidate_words()
    by_length = {n: 0 for n in TARGET_LENGTHS}

    db = SessionLocal()
    try:
        existing = {w for (w,) in db.query(WordDb.word).all()}
        to_insert = candidates - existing

        for word in to_insert:
            db.add(WordDb(word=word, length=len(word)))
            by_length[len(word)] += 1

        db.commit()
    finally:
        db.close()

    print(f"Inserted {sum(by_length.values())} new words:")
    for length, count in by_length.items():
        print(f"  {length}-letter: {count}")


if __name__ == "__main__":
    main()
