import * as React from 'react';
import { Button } from 'react-bootstrap';
import Bookmark, { BookmarkType } from '../bookmark';

type Props = {
  currentTitle: string,
  currentUrl: string,
  submit: (url: string) => void,
};

function BookmarkOptions(props: {bookmarks: BookmarkType}) {
  return (
    <>
    {
      Object.keys(props.bookmarks).map((key) => (
        <option value={key} key={`bookmark-option-${key}`}>{`${props.bookmarks[key]}: ${key}`}</option>
      ))
    }
    </>
  );
}

export default function BookmarkView(props: Props) {
  const [bookmarks, setBookmarks] = React.useState({} as BookmarkType);
  const [selected, setSelected] = React.useState(props.currentUrl);

  React.useEffect(() => {
    const bookmarks = Bookmark.get();
    setBookmarks(bookmarks);
  }, [])

  function moveBookmark() {
    if (!selected) return;

    props.submit(selected);
  }

  function deleteBookmark() {
    Bookmark.delete(selected);
    const newBookmarks = Bookmark.get();
    setBookmarks(newBookmarks);
  }

  function addBookmark() {
    Bookmark.add(props.currentUrl, props.currentTitle);
    const newBookmarks = Bookmark.get();
    setBookmarks(newBookmarks);
  }

  return (
    <div className='bookmark-bar'>
      ブックマーク
      <select className='bookmark-select form-control' defaultValue={selected} onChange={(e) => setSelected(e.target.value)}>
        <BookmarkOptions bookmarks={bookmarks} />
      </select>
      <Button bsStyle='default' title='選択中のブックマークに移動' onClick={moveBookmark}><i className='fa fa-sign-in'></i></Button>
      <Button bsStyle='default' title='選択中のブックマークを削除' onClick={() => deleteBookmark()}><i className='fa fa-trash'></i></Button>
      <Button bsStyle='default' title='表示中のページをブックマークに追加' onClick={() => addBookmark()}>
        <i className='fa fa-plus'></i>
      </Button>
    </div>
  );
}
